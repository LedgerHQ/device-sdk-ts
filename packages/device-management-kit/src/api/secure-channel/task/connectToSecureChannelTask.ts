import WebSocket from "isomorphic-ws";
import { type Either } from "purify-ts";
import { Observable } from "rxjs";

import {
  type ApduResponse,
  bufferToHexaString,
  CommandUtils,
  hexaStringToBuffer,
  type InternalApi,
} from "@api/index";
import {
  InMessageQueryEnum,
  type InMessageType,
  OutMessageResponseEnum,
  type OutMessageType,
  type SecureChannelEvent,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import {
  isRefusedByUser,
  willRequestPermission,
} from "@api/secure-channel/utils";
import {
  SecureChannelError,
  type WebSocketConnectionError,
} from "@internal/secure-channel/model/Errors";

const USER_ACTION_TIMEOUT = 500;

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
    const obs = new Observable<SecureChannelEvent>((subscriber) => {
      let unsubscirbed: boolean = false;
      let inBulkMode = false;
      let communicationFinished = false;
      let userActionTimeout: NodeJS.Timeout | null = null;
      let deviceError: SecureChannelError | null = null;
      let waitingForUserAction = false;

      this._connection.onopen = () => {
        subscriber.next({
          type: SecureChannelEventType.Opened,
        });
      };

      this._connection.onerror = (error) => {
        // When the bulk sending is in progress, network error is ignored
        if (inBulkMode) {
          return;
        }

        subscriber.error(
          new SecureChannelError({
            url: this._connection.url,
            errorMessage: error.message,
          }),
        );
      };

      this._connection.onclose = () => {
        // When the bulk sending is in progress, network event is ignored
        if (inBulkMode) {
          return;
        }

        if (communicationFinished) {
          subscriber.next({
            type: SecureChannelEventType.Closed,
          });
          subscriber.complete();
        } else {
          subscriber.error(
            new SecureChannelError(
              deviceError ?? {
                url: this._connection.url,
                errorMessage: "Connection closed unexpectedly",
              },
            ),
          );
        }
      };

      this._connection.onmessage = async (event) => {
        // When unsubscribed, ignore the message
        if (unsubscirbed) {
          return;
        }
        deviceError = null;

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const input: InMessageType = JSON.parse(String(event.data));

          switch (input.query) {
            case InMessageQueryEnum.EXCHANGE: {
              const { nonce } = input;

              if (Array.isArray(input.data)) {
                subscriber.error(
                  new SecureChannelError(
                    `${InMessageQueryEnum.EXCHANGE} data type should not be Array`,
                  ),
                );
                break;
              }

              const apdu = hexaStringToBuffer(input.data);

              if (apdu === null || apdu.length < 5) {
                subscriber.error(
                  new SecureChannelError(
                    `Received invalid APDU data: ${input.data}`,
                  ),
                );
                break;
              }

              subscriber.next({
                type: SecureChannelEventType.PreExchange,
                payload: { nonce, apdu },
              });

              if (willRequestPermission(apdu)) {
                waitingForUserAction = true;
                userActionTimeout = setTimeout(() => {
                  if (unsubscirbed) {
                    return;
                  }
                  subscriber.next({
                    type: SecureChannelEventType.PermissionRequested,
                  });
                }, USER_ACTION_TIMEOUT);
              }

              const response = await this._api.sendApdu(apdu);

              if (userActionTimeout && response) {
                clearTimeout(userActionTimeout);
                userActionTimeout = null;
              }

              if (unsubscirbed) {
                return;
              }

              response.caseOf({
                Left: (error) => {
                  subscriber.error(new SecureChannelError(error));
                },
                Right: (apduResponse: ApduResponse) => {
                  let outMessageResponse: OutMessageResponseEnum;
                  /**
                   * | Status Code | Description                        | Event Emitted                      |
                   * |-------------|------------------------------------|------------------------------------|
                   * | 0x9000      | Success                            | SecureChannelEventEnum.Exchange    |
                   * | 0x5515      | Device is locked                   | Error                              |
                   * | 0x5501      | User refused on the device         | Error                              |
                   * | 0x6985      | Condition of use not satisfied     | Error                              |
                   */
                  // Success response
                  if (CommandUtils.isSuccessResponse(apduResponse)) {
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
                  } else {
                    outMessageResponse = OutMessageResponseEnum.ERROR;

                    deviceError = new SecureChannelError({
                      url: this._connection.url,
                      errorMessage: `Invalid status code: ${bufferToHexaString(
                        apduResponse.statusCode,
                      )}`,
                    });

                    // Device is locked
                    if (CommandUtils.isLockedDeviceResponse(apduResponse)) {
                      subscriber.error(
                        new SecureChannelError({
                          url: this._connection.url,
                          errorMessage: `Device is locked`,
                        }),
                      );
                      return;
                    }

                    // User refused the permission
                    if (
                      isRefusedByUser(apduResponse.statusCode) &&
                      waitingForUserAction
                    ) {
                      subscriber.error(
                        new SecureChannelError({
                          url: this._connection.url,
                          errorMessage: "User refused on the device",
                        }),
                      );
                      return;
                    }
                  }

                  if (waitingForUserAction) {
                    subscriber.next({
                      type: SecureChannelEventType.PermissionGranted,
                    });
                    waitingForUserAction = false;
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
              inBulkMode = true;
              this._connection.close();

              if (!Array.isArray(input.data) || input.data.length === 0) {
                subscriber.error(
                  new SecureChannelError("Invalid bulk data received"),
                );
                break;
              }

              const apdus = input.data.reduce(
                (acc: Array<Uint8Array>, cur: string) => {
                  const apdu = hexaStringToBuffer(cur);
                  return apdu === null ? acc : [...acc, apdu];
                },
                [],
              );

              for (let i = 0, len = apdus.length; i < len; i++) {
                await this._api.sendApdu(apdus[i]!);
                if (unsubscirbed) {
                  subscriber.error(
                    new SecureChannelError(
                      "Bulk sending cancelled by unsubscribing",
                    ),
                  );
                  break;
                }
                subscriber.next({
                  type: SecureChannelEventType.Progress,
                  payload: {
                    progress: +Number((i + 1) / len).toFixed(2),
                    index: i,
                    total: len,
                  },
                });
              }
              communicationFinished = true;
              subscriber.complete();
              break;
            }
            case InMessageQueryEnum.SUCCESS: {
              // Ignore success message when in bulk mode
              if (inBulkMode) {
                break;
              }
              // Emit the result if there is any
              const payload = input.result ?? input.data;
              if (payload) {
                subscriber.next({
                  type: SecureChannelEventType.Result,
                  payload: String(payload ?? ""),
                });
              }
              communicationFinished = true;
              subscriber.complete();
              break;
            }
            case InMessageQueryEnum.WARNING: {
              // Ignore warning message when in bulk mode
              if (inBulkMode) {
                break;
              }
              subscriber.next({
                type: SecureChannelEventType.Warning,
                payload: { message: String(input.data) },
              });
              break;
            }
            case InMessageQueryEnum.ERROR: {
              if (inBulkMode) {
                break;
              }
              subscriber.error(
                new SecureChannelError({
                  url: this._connection.url,
                  errorMessage: String(input.data),
                }),
              );
            }
          }
        } catch (error) {
          deviceError = new SecureChannelError(error);
          subscriber.error(deviceError);
        }
      };
      return () => {
        unsubscirbed = true;
        // Close the connection if it is open when unsubscribing
        if (this._connection.readyState === WebSocket.OPEN) {
          this._connection.close();
        }
      };
    });
    return obs;
  }
}
