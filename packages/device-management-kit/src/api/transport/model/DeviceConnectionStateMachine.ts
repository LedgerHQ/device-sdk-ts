// import { createBrowserInspector } from "@statelyai/inspect";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { type Actor, assign, createActor, emit, setup } from "xstate";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DmkError, UnknownDeviceExchangeError } from "@api/Error";
import { type DeviceId } from "@api/types";

import { type DeviceApduSender } from "./DeviceApduSender";
import {
  AlreadySendingApduError,
  DeviceDisconnectedBeforeSendingApdu,
  DeviceDisconnectedWhileSendingError,
} from "./Errors";

// const { inspect } = createBrowserInspector();

type DeviceDetachedEvent = {
  type: "DeviceDetached";
};

type DeviceAttachedEvent = {
  type: "DeviceAttached";
};

type ApduResponseReceived = {
  type: "ApduResponseReceived";
  apduResponse: ApduResponse;
};

type ApduSendingError = {
  type: "ApduSendingError";
  error: DmkError;
};

type SendApduCalled = {
  type: "SendApduCalled";
  apdu: Uint8Array;
  triggersDisconnection: boolean;
  abortTimeout?: number;
  responseCallback: (response: Either<DmkError, ApduResponse>) => void;
};

type ReconnectionTimedOut = {
  type: "ReconnectionTimedOut";
};

type CloseConnectionCalled = {
  type: "CloseConnectionCalled";
};

export type DeviceConnectionEvent =
  | DeviceDetachedEvent
  | DeviceAttachedEvent
  | ApduResponseReceived
  | ApduSendingError
  | SendApduCalled
  | CloseConnectionCalled
  | ReconnectionTimedOut;

export type DeviceConnectionStateMachineParams<Dependencies> = {
  deviceId: DeviceId;
  deviceApduSender: DeviceApduSender<Dependencies>;
  timeoutDuration: number;
  onTerminated: () => void;
};

export class DeviceConnectionStateMachine<Dependencies> {
  private deviceId: DeviceId;
  private deviceAdpuSender: DeviceApduSender<Dependencies>;

  private machineActor: Actor<ReturnType<typeof makeStateMachine>>;

  private timeoutDuration: number;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  startReconnectionTimeout() {
    this.timeout = setTimeout(() => {
      this.machineActor.send({ type: "ReconnectionTimedOut" });
    }, this.timeoutDuration);
  }

  constructor(params: DeviceConnectionStateMachineParams<Dependencies>) {
    this.deviceId = params.deviceId;
    this.deviceAdpuSender = params.deviceApduSender;
    this.timeoutDuration = params.timeoutDuration;
    this.machineActor = createActor(
      makeStateMachine({
        sendApduFn: (apdu, triggersDisconnection, abortTimeout) =>
          this.sendApduToDeviceConnection(
            apdu,
            triggersDisconnection,
            abortTimeout,
          ),
        startReconnectionTimeout: () => this.startReconnectionTimeout(),
        cancelReconnectionTimeout: () => {
          if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
          }
        },
        onTerminated: params.onTerminated,
        closeConnection: () => {
          this.deviceAdpuSender.closeConnection();
        },
      }),
      // {
      //   // inspect,
      // },
    );
    this.machineActor.start();
  }

  private sendApduToDeviceConnection(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
    abortTimeout?: number,
  ) {
    this.deviceAdpuSender
      .sendApdu(apdu, triggersDisconnection, abortTimeout)
      .then((response) => {
        response.caseOf({
          Left: (error) => {
            this.machineActor.send({ type: "ApduSendingError", error });
          },
          Right: (apduResponse) => {
            this.machineActor.send({
              type: "ApduResponseReceived",
              apduResponse,
            });
          },
        });
      })
      .catch((error) => {
        this.machineActor.send({
          type: "ApduSendingError",
          error: new UnknownDeviceExchangeError(error),
        });
      });
  }

  /**
   * Called by the transport
   */

  public getDependencies(): Dependencies {
    return this.deviceAdpuSender.getDependencies();
  }

  public setDependencies(dependencies: Dependencies) {
    this.deviceAdpuSender.setDependencies(dependencies);
  }

  public getDeviceId() {
    return this.deviceId;
  }

  public sendApdu(
    apdu: Uint8Array,
    triggersDisconnection?: boolean,
    abortTimeout?: number,
  ): Promise<Either<DmkError, ApduResponse>> {
    return new Promise((responseCallback) => {
      this.machineActor.send({
        type: "SendApduCalled",
        apdu,
        triggersDisconnection: !!triggersDisconnection,
        abortTimeout,
        responseCallback,
      });
    });
  }

  public async setupConnection() {
    await this.deviceAdpuSender.setupConnection();
  }

  // State Machine Events

  public eventDeviceAttached() {
    this.machineActor.send({ type: "DeviceAttached" });
  }

  public eventDeviceDetached() {
    this.machineActor.send({ type: "DeviceDetached" });
  }

  public closeConnection() {
    this.machineActor.send({ type: "CloseConnectionCalled" });
  }
}

function makeStateMachine({
  sendApduFn,
  startReconnectionTimeout,
  cancelReconnectionTimeout,
  onTerminated,
  closeConnection,
}: {
  sendApduFn: (
    apdu: Uint8Array,
    triggersDisconnection: boolean,
    abortTimeout?: number,
  ) => void;
  startReconnectionTimeout: () => void;
  cancelReconnectionTimeout: () => void;
  onTerminated: () => void;
  closeConnection: () => void;
}) {
  return setup({
    types: {} as {
      context: {
        apduInProgress: Maybe<{
          apdu: Uint8Array;
          triggersDisconnection: boolean;
          abortTimeout?: number;
          responseCallback: (response: Either<DmkError, ApduResponse>) => void;
        }>;
      };
      events: DeviceConnectionEvent;
    },
    actions: {
      // event transitions
      startTimer: () => {
        startReconnectionTimeout();
      },
      cancelTimer: () => {
        cancelReconnectionTimeout();
      },
      reconnectionTimeoutEvent: emit({ type: "ReconnectionTimedOut" }),
      sendApdu: ({ context }) => {
        context.apduInProgress.map(({ apdu, abortTimeout }) => {
          sendApduFn(apdu, false, abortTimeout);
        });
      },
      sendApduResponse: (
        { context },
        params: { response: Either<DmkError, ApduResponse> },
      ) => {
        context.apduInProgress.map(({ responseCallback }) =>
          responseCallback(params.response),
        );
      },
      cleanupContext: assign({ apduInProgress: Nothing }),
      signalTermination: () => {
        onTerminated();
      },
      closeConnection: () => {
        closeConnection(); // ASK: how do we handle errors ?
      },
    },
    guards: {
      isApduThatTriggersDisconnection: (
        { context },
        params: { apduResponse: ApduResponse },
      ) => {
        return context.apduInProgress.caseOf({
          Just: ({ triggersDisconnection, apdu }) => {
            const res =
              (triggersDisconnection ||
                CommandUtils.isApduThatTriggersDisconnection(apdu)) &&
              CommandUtils.isSuccessResponse(params.apduResponse);
            return res;
          },
          Nothing: () => false,
        });
      },
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QTANwJYGMwGED2AdgWJgC7qEB0+RJpkAxACJpZgukCGmAFpANoAGALqJQABzyx05QmJAAPRAA4A7AGZKywQEYAnAFYATMoAsBg6fUA2ADQgAnolUnKBjUdXXVpnUb0aAL6B9igY2DTEZBQE1IRR9BAMAMpgBBAAguIQAK44nAA2BQIi8pLSsgTySgjW6oKU6uo61kbWyh06Vsr2TgjqAZR6HUaWXcrqBmrBoawR8XQxcbRkjDgFUrgL0YT5RSWiSCDlMjHVKnrWjaO6ev6qlnp6vYim1qaN9YLqGuPKOjpVDMQGE2JFFlRUul0AQoFlcgx4TkAEpwSQEWBgVHYdCoA5lKSnORHGpNVSUPwGXQDQSmNTDF4IZTWPRDJotUw+HwAnTA0HzFaVShQiAwuHZHKIiWo2DozHYsC4gQ6Q4SQmVc79TxDIzqG6eJq+VSM94NPQ6CYuUzmQGCax8uZbQVLEVipFS3Ku2EAUQATr68L6hKrjuqziTEJNNHrTG1dIIDE8jLTGVTlJQboI2i56QZeSEQY7wTtYl7xQiWOF2GAuLx8UcThqIwh-OmdBZPF0qQCBoydIJlAZKK0jP4bHntBaHVXi0Ky+71ptZzE9sUIMGCRVw6Aau2dJQ6WZlMM-D9+89HIh++mbndVHpdNYLAnp2DtnO0qLYe6RUjV-W1S3Ykd0QABac1KFpbx3kHCxumNS9ak5SDTHNax0NUDRfFMV8BQSJYAHVOFOWEADFA2xd8YmYR0MlIWs+HXUoGzDYDFEQQx90mVozABJ9BAvPo6iuFpRgtQRdDUWNcKdfCqCIkioHI31KOdQgUk-P9CjXDcWKAqpmx0dR-gpCTaXNUxvh7RkvCHWlaWM9RfC6dCZOXeTiPIMiKJIKj1NUuSCAAFXQABbSAAHkclIXTAKJAyQIQLpBHJAEXB8AS1HvdRGT0a0D2ZZpBxjSc3L82IFK8pSfMwcqGEXTF3IIf8mJDRtt3YpLLPJZMWkmTtzJyxD+1UBofifVQOm8YyWjKtSKs8sVlICiECAImQeAARRyMAdogX8JRoqs6IYgDQ30zUjJ8CkWQmYZbOsFLGWzUyzE5bssx8ObAsoSqlpq8r1tILadr2g6ERWksQvCiAopi5i4qbRKjH7Bo4N1dsvFjOxEIeIwUPQ9o9AGSYvG+1bfsW7yVN8+agZB3bIHByUGtk1aWti874s1FGJOHYy6gTLo3lMVN7wPBNVAtbRRg0IEC35NmS0pxTltpwL6e2xn9s0w7mY5hGuaRzrAWZIYBJpc0pd1E18tNMZLOMAwnOCAsCDwFB4CORWms3bnm1AozWSgrHYMsYyEL6FGKXcDleMMO5rXJ5XZ0gP3jZqB4evaLwXEeqwnJNKYDypWlzHePwcIVotyuFT83QldOOpqWNU30A8rEmrMjPcAJk6FP7qch432rY3dxnN1onlaZ9idy5NILuCxl+UEwrH7wiqeqmnarpjatbB3Xcibser3eckfmd3xOkrnpce0DMjHMeoAgLjeqCCsBfVCmFOESE+EqdSfnmNwLJjBPBSs0QwuV3CQWPN3AwT4LTtldoEIAA */
    id: "deviceConnection",
    initial: "Connected",
    context: {
      apduInProgress: Nothing,
    },
    states: {
      Connected: {
        on: {
          DeviceDetached: {
            target: "WaitingForReconnection",
          },
          SendApduCalled: {
            target: "SendingApdu",
            actions: assign({
              apduInProgress: ({ event }) => {
                return Maybe.of({
                  apdu: event.apdu,
                  triggersDisconnection: event.triggersDisconnection,
                  abortTimeout: event.abortTimeout,
                  responseCallback: event.responseCallback,
                });
              },
            }),
          },
          CloseConnectionCalled: {
            target: "Terminated",
          },
        },
      },
      SendingApdu: {
        entry: "sendApdu",
        on: {
          ApduResponseReceived: [
            {
              guard: {
                type: "isApduThatTriggersDisconnection",
                params: ({ event }) => ({ apduResponse: event.apduResponse }),
              },
              target: "WaitingForReconnection",
              actions: [
                {
                  type: "sendApduResponse",
                  // https://stately.ai/docs/actions#dynamic-action-parameters
                  params: ({ event }) => {
                    return {
                      response: Right(event.apduResponse),
                    };
                  },
                },
                { type: "cleanupContext" },
              ],
            },
            {
              target: "Connected",
              actions: [
                {
                  type: "sendApduResponse",
                  // https://stately.ai/docs/actions#dynamic-action-parameters
                  params: ({ event }) => {
                    return {
                      response: Right(event.apduResponse),
                    };
                  },
                },
                { type: "cleanupContext" },
              ],
            },
          ],
          ApduSendingError: {
            target: "Connected",
            actions: [
              {
                type: "sendApduResponse",
                // https://stately.ai/docs/actions#dynamic-action-parameters
                params: ({ event }) => {
                  return {
                    response: Left(event.error),
                  };
                },
              },
              "cleanupContext",
            ],
          },
          DeviceDetached: {
            target: "WaitingForReconnection",
            actions: [
              {
                type: "sendApduResponse",
                params: {
                  response: Left(new DeviceDisconnectedWhileSendingError()),
                },
              },
              "cleanupContext",
            ],
          },
          CloseConnectionCalled: {
            target: "Terminated",
            actions: [
              {
                type: "sendApduResponse",
                params: {
                  response: Left(new DeviceDisconnectedWhileSendingError()),
                },
              },
              "cleanupContext",
            ],
          },
          SendApduCalled: {
            actions: ({ event }) => {
              event.responseCallback(Left(new AlreadySendingApduError()));
            },
          },
        },
      },
      WaitingForReconnection: {
        entry: "startTimer",
        on: {
          DeviceAttached: {
            target: "Connected",
            actions: "cancelTimer",
          },
          SendApduCalled: {
            target: "WaitingForReconnectionWithQueuedSendApdu",
            actions: assign({
              apduInProgress: ({ event }) => {
                return Maybe.of({
                  apdu: event.apdu,
                  triggersDisconnection: event.triggersDisconnection,
                  abortTimeout: event.abortTimeout,
                  responseCallback: event.responseCallback,
                });
              },
            }),
          },
          ReconnectionTimedOut: {
            target: "Terminated",
          },
          CloseConnectionCalled: {
            target: "Terminated",
          },
        },
      },
      WaitingForReconnectionWithQueuedSendApdu: {
        on: {
          DeviceAttached: {
            target: "SendingApdu",
            actions: "cancelTimer",
          },
          ReconnectionTimedOut: {
            target: "Terminated",
            actions: [
              {
                type: "sendApduResponse",
                params: {
                  response: Left(new DeviceDisconnectedBeforeSendingApdu()),
                },
              },
              {
                type: "cleanupContext",
              },
            ],
          },
          CloseConnectionCalled: {
            target: "Terminated",
            actions: [
              {
                type: "sendApduResponse",
                params: {
                  response: Left(new DeviceDisconnectedWhileSendingError()),
                },
              },
              "cleanupContext",
            ],
          },
          SendApduCalled: {
            actions: ({ event }) => {
              event.responseCallback(Left(new AlreadySendingApduError()));
            },
          },
        },
      },
      // TODO: ADD INACTIVE STATE
      Terminated: {
        entry: ["signalTermination", "closeConnection"],
        type: "final",
      },
    },
  });
}
