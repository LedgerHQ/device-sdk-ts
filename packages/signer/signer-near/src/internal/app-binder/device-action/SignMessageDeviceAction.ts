import {
  type CommandResult,
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
import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
import {
  SignMessageTask,
  type SignMessageTaskArgs,
} from "@internal/app-binder/task/SignMessageTask";

export type MachineDependencies = {
  readonly signMessageTask: () => Promise<
    CommandResult<Uint8Array, NearAppErrorCodes>
  >;
};

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

    const { signMessageTask } = this.extractDependencies(
      internalApi,
      this.input,
    );

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "NEAR" },
        }).makeStateMachine(internalApi),
        SignMessageTask: fromPromise(signMessageTask),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
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
            input: { appName: "NEAR" },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<SignMessageDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "SignMessageTask",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        SignMessageTask: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "SignMessageTask",
            src: "SignMessageTask",
            onDone: {
              target: "SignResultCheck",
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
        SignResultCheck: {
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

  extractDependencies(
    internalApi: InternalApi,
    input: { args: SignMessageTaskArgs },
  ): MachineDependencies {
    const signMessageTask = async () =>
      new SignMessageTask(internalApi, input.args).run();

    return {
      signMessageTask,
    };
  }
}
