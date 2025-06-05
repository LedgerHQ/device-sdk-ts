import WebSocket from "isomorphic-ws";
import { type Either } from "purify-ts";
import { Observable } from "rxjs";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import {
  InMessageQueryEnum,
  type InMessageType,
  OutMessageResponseEnum,
  type OutMessageType,
  type SecureChannelEvent,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import { willRequestPermission } from "@api/secure-channel/utils";
import { bufferToHexaString, hexaStringToBuffer } from "@api/utils/HexaString";
import {
  SecureChannelError,
  SecureChannelErrorType,
  type WebSocketConnectionError,
} from "@internal/secure-channel/model/Errors";

export type ConnectToSecureChannelTaskArgs = {
  connection: Either<WebSocketConnectionError, WebSocket>;
};

export class ConnectToSecureChannelTask {
  private readonly _connection: WebSocket;
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: ConnectToSecureChannelTaskArgs,
  ) {
    if (this._args.connection.isRight()) {
      this._connection = this._args.connection.extract();
    } else {
      throw new SecureChannelError(
        `Invalid WebSocket connection: ${String(this._args.connection.extract())}`,
      );
    }
  }

  run(): Observable<SecureChannelEvent> {
    const reenableRefresher = this._api.disableRefresher(
      "connectToSecureChannel",
    );

    const obs = new Observable<SecureChannelEvent>((subscriber) => {
      let unsubscribed: boolean = false;
      let ignoreNetworkEvents = false;
      let communicationFinished = false;

      const notifyError = (error: SecureChannelError) => {
        subscriber.next({
          type: SecureChannelEventType.Error,
          error,
        });
        subscriber.complete();

        // Netowrks events can be ignored once the obervable has been completed
        ignoreNetworkEvents = true;
      };

      this._connection.onopen = () => {
        subscriber.next({
          type: SecureChannelEventType.Opened,
        });
      };

      this._connection.onerror = (error) => {
        if (ignoreNetworkEvents) {
          return;
        }

        subscriber.next({
          type: SecureChannelEventType.Error,
          error: new SecureChannelError({
            url: this._connection.url,
            errorMessage: error.message,
          }),
        });
        subscriber.complete();
      };

      this._connection.onclose = () => {
        if (ignoreNetworkEvents) {
          return;
        }

        if (communicationFinished) {
          subscriber.next({
            type: SecureChannelEventType.Closed,
          });
        } else {
          subscriber.next({
            type: SecureChannelEventType.Error,
            error: new SecureChannelError({
              url: this._connection.url,
              errorMessage: "Connection closed unexpectedly",
            }),
          });
        }
        subscriber.complete();
      };

      this._connection.onmessage = async (event) => {
        // When unsubscribed, ignore the message
        if (unsubscribed) {
          return;
        }

        // Parse input message
        let input: InMessageType;
        try {
          const jsonData = JSON.parse(String(event.data));
          if (this.isInMessageType(jsonData)) {
            input = jsonData;
          } else {
            throw new Error("Data does not match InMessageType");
          }
        } catch (_) {
          notifyError(
            new SecureChannelError({
              url: this._connection.url,
              errorMessage: `Invalid message received: ${String(event.data)}`,
            }),
          );
          return;
        }

        // Execute message query
        switch (input.query) {
          case InMessageQueryEnum.EXCHANGE: {
            const { nonce, data } = input;

            // Exchange query should contain a single APDU
            if (typeof data !== "string") {
              notifyError(
                new SecureChannelError(
                  `${InMessageQueryEnum.EXCHANGE} data type should be an APDU`,
                ),
              );
              return;
            }

            // APDU should be a valid hex string
            const apdu = hexaStringToBuffer(data);
            if (apdu === null || apdu.length < 5) {
              notifyError(
                new SecureChannelError(`Received invalid APDU data: ${data}`),
              );
              return;
            }
            subscriber.next({
              type: SecureChannelEventType.PreExchange,
              payload: { nonce, apdu },
            });

            // Notify permission requested
            let permissionRequested = false;
            if (
              willRequestPermission(apdu) &&
              !this.isSecureConnectionAllowed()
            ) {
              permissionRequested = true;
              subscriber.next({
                type: SecureChannelEventType.PermissionRequested,
              });
            }

            // Send APDU to the device
            const response = await this._api.sendApdu(apdu);
            if (unsubscribed) {
              return;
            }

            // Map device response
            response.caseOf({
              Left: (error) => {
                notifyError(new SecureChannelError(error));
              },
              Right: (apduResponse: ApduResponse) => {
                let outMessageResponse: OutMessageResponseEnum;
                const deviceError = this.mapDeviceError(apduResponse);
                if (deviceError === null) {
                  outMessageResponse = OutMessageResponseEnum.SUCCESS;

                  // Emit event for the exchange
                  subscriber.next({
                    type: SecureChannelEventType.Exchange,
                    payload: {
                      nonce,
                      apdu,
                      data: apduResponse.data,
                      status: apduResponse.statusCode,
                    },
                  });

                  // If manager consent was requested, notify the "granted" event
                  if (permissionRequested) {
                    subscriber.next({
                      type: SecureChannelEventType.PermissionGranted,
                    });
                  }
                } else {
                  outMessageResponse = OutMessageResponseEnum.ERROR;
                  notifyError(deviceError);
                }

                // Send the message back to the server
                const message: OutMessageType = {
                  nonce,
                  response: outMessageResponse,
                  data: bufferToHexaString(apduResponse.data).slice(2),
                };
                this._connection.send(JSON.stringify(message));
              },
            });
            break;
          }
          case InMessageQueryEnum.BULK: {
            // Network not needed anymore during bulk APDUs sending
            ignoreNetworkEvents = true;
            this._connection.close();

            // A valid array of APDUs is required in a bulk query
            if (
              !Array.isArray(input.data) ||
              input.data.length === 0 ||
              !input.data.every((data) => typeof data === "string")
            ) {
              notifyError(new SecureChannelError("Invalid bulk data received"));
              return;
            }

            for (let i = 0, len = input.data.length; i < len; i++) {
              // APDU should be a valid hex string
              const apdu = hexaStringToBuffer(input.data[i]!);
              if (apdu === null || apdu.length < 5) {
                notifyError(
                  new SecureChannelError(
                    `Received invalid APDU bulk data: ${input.data[i]}`,
                  ),
                );
                return;
              }

              // Send APDU to the device
              const response = await this._api.sendApdu(apdu);
              if (unsubscribed) {
                return;
              }

              // Map device response
              if (response.isLeft()) {
                notifyError(new SecureChannelError(response.extract()));
                return;
              } else if (response.isRight()) {
                const deviceError = this.mapDeviceError(response.extract());
                if (deviceError === null) {
                  // Notify the progress
                  subscriber.next({
                    type: SecureChannelEventType.Progress,
                    payload: {
                      progress: +Number((i + 1) / len).toFixed(2),
                      index: i,
                      total: len,
                    },
                  });
                } else {
                  notifyError(deviceError);
                  return;
                }
              }
            }
            communicationFinished = true;
            subscriber.complete();
            break;
          }
          case InMessageQueryEnum.SUCCESS: {
            if (ignoreNetworkEvents) {
              break;
            }
            // Emit the result if there is any
            const payload = input.result ?? input.data;
            if (payload) {
              subscriber.next({
                type: SecureChannelEventType.Result,
                payload: payload ?? "",
              });
            }
            communicationFinished = true;
            subscriber.complete();
            break;
          }
          case InMessageQueryEnum.WARNING: {
            if (ignoreNetworkEvents) {
              break;
            }
            subscriber.next({
              type: SecureChannelEventType.Warning,
              payload: { message: String(input.data) },
            });
            break;
          }
          case InMessageQueryEnum.ERROR: {
            if (ignoreNetworkEvents) {
              break;
            }
            notifyError(
              new SecureChannelError({
                url: this._connection.url,
                errorMessage: String(input.data),
              }),
            );
          }
        }
      };

      return () => {
        reenableRefresher();
        unsubscribed = true;
        // Close the connection if it is open when unsubscribing
        if (this._connection.readyState === WebSocket.OPEN) {
          this._connection.close();
        }
      };
    });

    return obs;
  }

  /**
   * Determines if a secure connection is already allowed based on the current device session state.
   *
   * @returns {boolean} `true` if a secure connection is allowed, otherwise `false`.
   */
  isSecureConnectionAllowed(): boolean {
    const deviceSessionState = this._api.getDeviceSessionState();
    return (
      "isSecureConnectionAllowed" in deviceSessionState &&
      deviceSessionState.isSecureConnectionAllowed
    );
  }

  isInMessageType(data: unknown): data is InMessageType {
    if (typeof data !== "object" || !data) {
      return false;
    }

    const message = data as InMessageType;
    return (
      typeof message.uuid === "string" &&
      typeof message.session === "string" &&
      typeof message.query === "string" &&
      Object.values(InMessageQueryEnum).includes(message.query) &&
      typeof message.nonce === "number"
    );
  }

  mapDeviceError(apduResponse: ApduResponse): SecureChannelError | null {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return null;
    }

    // Device is locked
    if (CommandUtils.isLockedDeviceResponse(apduResponse)) {
      return new SecureChannelError(
        {
          url: this._connection.url,
          errorMessage: `Device is locked`,
        },
        SecureChannelErrorType.DeviceLocked,
      );
    }

    // User refused the permission
    if (CommandUtils.isRefusedByUser(apduResponse)) {
      return new SecureChannelError(
        {
          url: this._connection.url,
          errorMessage: "User refused on the device",
        },
        SecureChannelErrorType.RefusedByUser,
      );
    }

    // App already installed
    if (CommandUtils.isAppAlreadyInstalled(apduResponse)) {
      return new SecureChannelError(
        {
          url: this._connection.url,
          errorMessage: "App already installed",
        },
        SecureChannelErrorType.AppAlreadyInstalled,
      );
    }

    // Out of memory
    if (CommandUtils.isOutOfMemory(apduResponse)) {
      return new SecureChannelError(
        {
          url: this._connection.url,
          errorMessage: "Out of memory",
        },
        SecureChannelErrorType.OutOfMemory,
      );
    }

    return new SecureChannelError({
      url: this._connection.url,
      errorMessage: `Invalid status code: ${bufferToHexaString(
        apduResponse.statusCode,
      )}`,
    });
  }
}
