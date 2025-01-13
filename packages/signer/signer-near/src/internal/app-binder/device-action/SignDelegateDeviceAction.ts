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
  type SignDelegateDAError,
  type SignDelegateDAInput,
  type SignDelegateDAIntermediateValue,
  type SignDelegateDAInternalState,
  type SignDelegateDAOutput,
} from "@api/app-binder/SignDelegateDeviceActionTypes";
import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";
import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
import {
  SignDelegateTask,
  type SignDelegateTaskArgs,
} from "@internal/app-binder/task/SignDelegateTask";

export type MachineDependencies = {
  readonly getPublicKey: (args0: {
    input: { derivationPath: string };
  }) => Promise<CommandResult<string, NearAppErrorCodes>>;
  readonly signDelegateTask: (args0: {
    input: { publicKey: string } & SignDelegateTaskArgs;
  }) => Promise<CommandResult<Uint8Array, NearAppErrorCodes>>;
};

export class SignDelegateDeviceAction extends XStateDeviceAction<
  SignDelegateDAOutput,
  SignDelegateDAInput,
  SignDelegateDAError,
  SignDelegateDAIntermediateValue,
  SignDelegateDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignDelegateDAOutput,
    SignDelegateDAInput,
    SignDelegateDAError,
    SignDelegateDAIntermediateValue,
    SignDelegateDAInternalState
  > {
    type types = StateMachineTypes<
      SignDelegateDAOutput,
      SignDelegateDAInput,
      SignDelegateDAError,
      SignDelegateDAIntermediateValue,
      SignDelegateDAInternalState
    >;

    const { signDelegateTask, getPublicKey } =
      this.extractDependencies(internalApi);

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
        GetPublicKey: fromPromise(getPublicKey),
        SignDelegateTask: fromPromise(signDelegateTask),
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
      id: "SignDelegateDeviceAction",
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
            publicKey: null,
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
                  _.event.output.caseOf<SignDelegateDAInternalState>({
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
              target: "GetPublicKey",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        GetPublicKey: {
          invoke: {
            id: "GetPublicKey",
            src: "GetPublicKey",
            input: {
              derivationPath: this.input.args.derivationPath,
            },
            onDone: {
              target: "GetPublicKeyResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        publicKey: event.output.data,
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
        GetPublicKeyResultCheck: {
          always: [
            {
              target: "SignDelegateTask",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        SignDelegateTask: {
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
            id: "SignDelegateTask",
            src: "SignDelegateTask",
            input: ({ context }) => ({
              ...this.input.args,
              publicKey: context._internalState.publicKey!,
            }),
            onDone: {
              target: "SignDelegateResultCheck",
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
        SignDelegateResultCheck: {
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
    const getPublicKey = ({
      input: { derivationPath },
    }: {
      input: { derivationPath: string };
    }) =>
      internalApi.sendCommand(
        new GetPublicKeyCommand({ derivationPath, checkOnDevice: false }),
      );

    const signDelegateTask = async ({
      input: { publicKey, ...args },
    }: {
      input: { publicKey: string } & SignDelegateTaskArgs;
    }) => new SignDelegateTask(internalApi, args).run(publicKey);

    return {
      getPublicKey,
      signDelegateTask,
    };
  }
}
