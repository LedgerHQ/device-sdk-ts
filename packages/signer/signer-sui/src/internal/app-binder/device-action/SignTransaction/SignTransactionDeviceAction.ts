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
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SuiSignature } from "@api/model/SuiSignature";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import {
  type DescriptorInput,
  ProvideTrustedDynamicDescriptorTask,
} from "@internal/app-binder/task/ProvideTrustedDynamicDescriptorTask";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

export type MachineDependencies = {
  readonly provideDescriptor: (arg0: {
    input: { descriptor: DescriptorInput };
  }) => Promise<CommandResult<void, SuiAppErrorCodes>>;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      transaction: Uint8Array;
      objectData?: Uint8Array[];
    };
  }) => Promise<CommandResult<SuiSignature, SuiAppErrorCodes>>;
};

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTransactionDAOutput,
    SignTransactionDAInput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue,
    SignTransactionDAInternalState
  > {
    type types = StateMachineTypes<
      SignTransactionDAOutput,
      SignTransactionDAInput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue,
      SignTransactionDAInternalState
    >;

    const { provideDescriptor, signTransaction } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
        provideDescriptor: fromPromise(provideDescriptor),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        hasDescriptor: ({ context }) => !!context.input.descriptor,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: new UnknownDAError(
              _.event["error"] instanceof Error
                ? _.event["error"].message
                : String(_.event["error"]),
            ),
          }),
        }),
      },
    }).createMachine({
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signTransactionDAStateSteps.OPEN_APP,
        },
        _internalState: {
          error: null,
          signature: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "CheckDescriptor", guard: "skipOpenApp" },
            { target: "OpenAppDeviceAction" },
          ],
        },
        OpenAppDeviceAction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.OPEN_APP,
            }),
          }),
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName: APP_NAME }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) => ({
                  ...event.snapshot.context.intermediateValue,
                  step: signTransactionDAStateSteps.OPEN_APP,
                }),
              }),
            },
            onDone: {
              target: "CheckOpenAppResult",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf({
                    Right: () => context._internalState,
                    Left: (error) => ({
                      ...context._internalState,
                      error,
                    }),
                  }),
              }),
            },
          },
        },
        CheckOpenAppResult: {
          always: [
            { target: "CheckDescriptor", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        CheckDescriptor: {
          always: [
            { target: "ProvideDescriptor", guard: "hasDescriptor" },
            { target: "SignTransaction" },
          ],
        },
        ProvideDescriptor: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.PROVIDE_DESCRIPTOR,
            }),
          }),
          invoke: {
            id: "provideDescriptor",
            src: "provideDescriptor",
            input: ({ context }) => ({
              descriptor: context.input.descriptor!,
            }),
            onDone: {
              target: "ProvideDescriptorResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? context._internalState
                    : { ...context._internalState, error: event.output.error },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideDescriptorResultCheck: {
          always: [
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signTransactionDAStateSteps.SIGN_TRANSACTION,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              objectData: context.input.objectData,
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (!isSuccessCommandResult(event.output))
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };

                  return {
                    ...context._internalState,
                    signature: event.output.data,
                  };
                },
                intermediateValue: {
                  requiredUserInteraction: UserInteractionRequired.None,
                  step: signTransactionDAStateSteps.SIGN_TRANSACTION,
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransactionResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) =>
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error or signature available"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const provideDescriptor = async (arg0: {
      input: { descriptor: DescriptorInput };
    }) =>
      new ProvideTrustedDynamicDescriptorTask(internalApi, {
        descriptor: arg0.input.descriptor,
      }).run();

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        transaction: Uint8Array;
        objectData?: Uint8Array[];
      };
    }) =>
      new SignTransactionTask(internalApi, {
        derivationPath: arg0.input.derivationPath,
        transaction: arg0.input.transaction,
        objectData: arg0.input.objectData,
      }).run();

    return {
      provideDescriptor,
      signTransaction,
    };
  }
}
