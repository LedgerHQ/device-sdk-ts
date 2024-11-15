import {
  type CommandResult,
  //CommandResultStatus,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignMessageDAError,
  type SignMessageDAInput,
  type SignMessageDAIntermediateValue,
  type SignMessageDAInternalState,
  type SignMessageDAOutput,
} from "@api/app-binder/SignMessageDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import {
  SendSignMessageTask,
  type SendSignMessageTaskArgs,
} from "@internal/app-binder/task/SendSignMessageTask";

export type MachineDependencies = {
  readonly signMessage: (arg0: {
    input: SendSignMessageTaskArgs;
  }) => Promise<CommandResult<Signature>>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class SignMessageDeviceAction extends XStateDeviceAction<
  SignMessageDAOutput,
  SignMessageDAInput,
  SignMessageDAError,
  SignMessageDAIntermediateValue,
  SignMessageDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignMessageDAOutput,
    SignMessageDAInput,
    SignMessageDAError,
    SignMessageDAIntermediateValue,
    SignMessageDAInternalState
  > {
    type types = StateMachineTypes<
      SignMessageDAOutput,
      SignMessageDAInput,
      SignMessageDAError,
      SignMessageDAIntermediateValue,
      SignMessageDAInternalState
    >;

    const { signMessage } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Solana" },
        }).makeStateMachine(internalApi),
        signMessage: fromPromise(signMessage),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        messageSizeWithinLimit: ({ context }) => {
          const messageSize = new TextEncoder().encode(
            context.input.message,
          ).length;
          const apduHeaderSize = 5;

          return apduHeaderSize + messageSize <= 255;
        },
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: ({ context, event }) => ({
            ...context._internalState,
            error: event["data"] as SignMessageDAError,
          }),
        }),
        assignErrorMessageTooBig: assign({
          _internalState: ({ context }) => ({
            ...context._internalState,
            error: {
              _tag: "InvalidMessageSizeError",
              errorCode: "MessageTooLarge",
              message:
                "The APDU command exceeds the maximum allowable size (255 bytes)",
            } as SignMessageDAError,
          }),
        }),
      },
    }).createMachine({
      id: "SignMessageDeviceAction",
      initial: "OpenAppDeviceAction",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            signature: null,
          },
        };
      },
      states: {
        OpenAppDeviceAction: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "openAppStateMachine",
            input: { appName: "Solana" },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              actions: assign({
                _internalState: ({ event, context }) => {
                  return event.output.caseOf<SignMessageDAInternalState>({
                    Right: () => context._internalState,
                    Left: (error) => ({
                      ...context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "CheckMessageSize",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        CheckMessageSize: {
          always: [
            {
              target: "SignMessage",
              guard: "messageSizeWithinLimit",
            },
            {
              target: "Error",
              actions: "assignErrorMessageTooBig",
            },
          ],
        },
        SignMessage: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction:
                UserInteractionRequired.SignPersonalMessage,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signMessage",
            src: "signMessage",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              sendingData: new TextEncoder().encode(context.input.message),
            }),
            onDone: {
              target: "SignMessageResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        signature: event.output.data,
                      };
                    }
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };
                  },
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignMessageResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { target: "Error" },
          ],
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const signMessage = async (arg0: { input: SendSignMessageTaskArgs }) => {
      const result = await new SendSignMessageTask(
        internalApi,
        arg0.input,
      ).run();
      return result;
    };

    return {
      signMessage,
    };
  }
}
