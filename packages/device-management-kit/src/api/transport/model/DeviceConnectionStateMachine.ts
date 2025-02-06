import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";
import { type Actor, assign, createActor, emit, setup } from "xstate";

import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type DmkError } from "@api/Error";

import { type SendApduFnType } from "./DeviceConnection";
import {
  DeviceDisconnectedBeforeSendingApdu,
  DeviceDisconnectedWhileSendingError,
} from "./Errors";

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
  responseCallback: (response: Either<DmkError, ApduResponse>) => void;
};

type ReconnectionTimedOut = {
  type: "ReconnectionTimedOut";
};

export type DeviceConnectionEvent =
  | DeviceDetachedEvent
  | DeviceAttachedEvent
  | ApduResponseReceived
  | ApduSendingError
  | SendApduCalled
  | ReconnectionTimedOut;

function makeStateMachine({
  sendApduFn,
  startReconnectionTimeout,
  cancelReconnectionTimeout,
  onApduResponse,
  onTerminated,
}: {
  sendApduFn: SendApduFnType;
  startReconnectionTimeout: () => void;
  cancelReconnectionTimeout: () => void;
  onApduResponse: (response: Either<DmkError, ApduResponse>) => void;
  onTerminated: () => void;
}) {
  return setup({
    types: {} as {
      context: {
        apduInProgress: Maybe<{
          apdu: Uint8Array;
          responseCallback: (response: Either<DmkError, ApduResponse>) => void;
        }>;
      };
      events: DeviceConnectionEvent;
      // actions: {
      //   sendApdu: () => void;
      //   sendApduResponse: (params: {
      //     response: Either<DmkError, ApduResponse>;
      //   }) => void;
      //   signalTermination: () => void;
      //   startTimer: () => void;
      //   cancelTimer: () => void;
      // };
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
        context.apduInProgress.caseOf({
          Just: ({ apdu }) => {
            sendApduFn(apdu);
          },
          Nothing: () => {
            console.error("sendApdu called while no apdu in progress");
          },
        });
      },
      sendApduResponse: () => {},

      // enqueueActions(
      //   ({ enqueue }, params: { response: Either<DmkError, ApduResponse> }) => {
      //     enqueue.assign({ apduInProgress: Nothing });
      //     onApduResponse(params.response);
      //   },
      // ),
      signalTermination: () => {
        onTerminated();
      },
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QTANwJYGMwGED2AdgWJgC7qEB0+RJpkAxACJpZgukCGmAFpANoAGALqJQABzyx05QmJAAPRACYAjKsqCAHAFYAnAGYDAFgBsB09r3GANCACeiVScoB2PatP69ewa9fKeloAvsF2KBjYNMRkFATUhDH0EAwAymAEEACC4hAArjicADZFAiLyktKyBPJKCGoa2vpGZhZWtg6IxjqClJ6mpsrGrqaquqOh4axRiXRxlOmZ6ARQOfkMa3kASnCSBLBgO9joqGWiSCCVMnG1TsojlCYGWmM9eqYjdo4IOq69HgNugYdOZVMYQmEQBE2NE5lRFhBlqtcnkNiiEUiAKIAJ2xeGxQnOEik1zkFzqzlUej6IIM1k8gkEOmUOi+iEGGmM-S0Xm6ygMakmUOmuFmsXhGURK02zBFHG4fAghIqJOqtwQziMlDMqj8ekCWmeRjZCAF1K5HyZrnB1uBxiF0JmtHF8QA6pxrisAGL4o5i6qyyJgLKkLi8M4qqo3ckqTyUHkBPxqQQ+fmszoILTGSiBTxjLSCV6-CFTIOwl2Ud2eqA+7F+50BhGbQolCMXK5qmMIUzGAw5rymLTW-X0rQm5TaSgDAZPcyjZQOkXl6qVj3kb2+kj+uIMetJOIAFXQAFtIAB5PKkZXt1XR0B1Ht95QDofGEdcscZl6UHqMvU6cZjHBRcy23Kgq3XGtN0wMCCFdGQeAARTyMAUIgJsUUDNgQzDRVr2JKMyXvO4HieF5dBTD5THHZk3F-MY9B0VRn1cAUQJhWDV2rWs9zhOCEOQ1DIAw9ZeJdI9TwgC8r3KG9CJqLtmNI3tyLeKjx0EZQczfPR-BGNNC1CSECDwFB4AuR1RQbO9LlvIjFEQABaaiM2c9inX3Khl0gSNSQU4iEGMZQTV0qchneACey0ZQXlcdyrM8+IMWlFFfM7ALVGZUxHg+cL3i0XTnxNICtD6adXB0SqWVzeLl3mCCkR4rdrPsjsbLqOlssEQY3lY5QWQMVwQq019Ux5QRulY2rOIajc62axL4NIJCULQkS8jS9rECHVwp3ca1BkGyqhw06l+kHJidCCrNGOmlr4gPMBsWPZZOGSTb7IpLKcoCHTB0Klzvi0UqLS8Q0PCMQ0FyMoA */
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
                  responseCallback: event.responseCallback,
                });
              },
            }),
          },
        },
      },
      SendingApdu: {
        entry: "sendApdu",
        on: {
          ApduResponseReceived: {
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
            ],
          },
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
            ],
          },
          DeviceDetached: {
            target: "WaitingForReconnection",
            actions: [
              {
                type: "sendApduResponse",
                params: {
                  response: Left(new DeviceDisconnectedWhileSendingError()), // TODO: proper error with description (e.g. "Device disconnected while sending APDU")
                },
              },
            ],
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
                  responseCallback: event.responseCallback,
                });
              },
            }),
          },
          ReconnectionTimedOut: {
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
            actions: {
              type: "sendApduResponse",
              params: {
                response: Left(new DeviceDisconnectedBeforeSendingApdu()),
              },
            },
          },
        },
      },
      Terminated: {
        entry: "signalTermination",
        type: "final",
      },
    },
  });
}

export class DeviceConnectionMachineState {
  private disconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  private machineActor: Actor<ReturnType<typeof makeStateMachine>>;

  startReconnectionTimeout() {
    this.disconnectTimeout = setTimeout(() => {
      this.machineActor.send({ type: "ReconnectionTimedOut" });
    }, 6000);
  }

  constructor(params: { sendApduFn: SendApduFnType }) {
    this.machineActor = createActor(makeStateMachine(params));
  }

  public sendApdu() {}

  public eventDeviceAttached() {}

  public eventDeviceDetached() {}

  public apduResponseReceived() {}

  public apduErrorReceived() {}
}
