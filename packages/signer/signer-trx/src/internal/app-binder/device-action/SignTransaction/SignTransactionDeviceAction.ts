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
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { GetTokenPayloadsTask } from "@internal/app-binder/task/GetTokenPayloadsTask";
import { ProvideContactTask } from "@internal/app-binder/task/ProvideContactTask";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<AppConfiguration, TronAppErrorCodes>
  >;
  readonly buildContext: (arg0: {
    input: { transaction: Uint8Array };
  }) => Promise<Uint8Array[]>;
  readonly provideContact: (arg0: {
    input: { transaction: Uint8Array; appConfig: AppConfiguration | null };
  }) => Promise<void>;
  readonly signTransaction: (arg0: {
    input: { transaction: Uint8Array; tokenPayloads: Uint8Array[] };
  }) => Promise<CommandResult<Signature, TronAppErrorCodes>>;
};

/**
 * Building the context is a state of its own rather than part of the signing
 * task so that `SignTransaction` is announced only once the device holds the
 * transaction, and not while the descriptor is still being fetched.
 */
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

    const { getAppConfig, buildContext, provideContact, signTransaction } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        getAppConfig: fromPromise(getAppConfig),
        buildContext: fromPromise(buildContext),
        provideContact: fromPromise(provideContact),
        signTransaction: fromPromise(signTransaction),
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
      },
      guards: {
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        noInternalError: ({ context }) => context._internalState.error === null,
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
          step: SignTransactionDAStep.OPEN_APP,
        },
        _internalState: {
          error: null,
          appConfig: null,
          tokenPayloads: null,
          signature: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "GetAppConfig", guard: "skipOpenApp" },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: { appName: APP_NAME },
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: SignTransactionDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              target: "CheckOpenAppDeviceActionResult",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<SignTransactionDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({ ..._.context._internalState, error }),
                  }),
              }),
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            { target: "GetAppConfig", guard: "noInternalError" },
            "Error",
          ],
        },
        GetAppConfig: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.GET_APP_CONFIG,
            },
          }),
          invoke: {
            id: "getAppConfig",
            src: "getAppConfig",
            onDone: {
              target: "BuildContext",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  appConfig: isSuccessCommandResult(event.output)
                    ? event.output.data
                    : null,
                }),
              }),
            },
            onError: { target: "BuildContext" },
          },
        },
        BuildContext: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXT,
            },
          }),
          invoke: {
            id: "buildContext",
            src: "buildContext",
            input: ({ context }) => ({
              transaction: context.input.transaction,
            }),
            onDone: {
              target: "ProvideContact",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  tokenPayloads: event.output,
                }),
              }),
            },
            // The task already folds a failed lookup into an empty set, so a
            // rejection is a host-side fault: review without the token name
            // rather than fail the signature.
            onError: {
              target: "ProvideContact",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                  tokenPayloads: [],
                }),
              }),
            },
          },
        },
        ProvideContact: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.PROVIDE_CONTACT,
            },
          }),
          invoke: {
            id: "provideContact",
            src: "provideContact",
            input: ({ context }) => ({
              transaction: context.input.transaction,
              appConfig: context._internalState.appConfig,
            }),
            onDone: { target: "SignTransaction" },
            onError: { target: "SignTransaction" },
          },
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => ({
              transaction: context.input.transaction,
              tokenPayloads: context._internalState.tokenPayloads ?? [],
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        signature: event.output.data,
                      }
                    : { ...context._internalState, error: event.output.error },
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
            { target: "Success", guard: "noInternalError" },
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
    const { addressBook, contextModule, derivationPath } = this.input;

    return {
      getAppConfig: () =>
        internalApi.sendCommand(new GetAppConfigurationCommand()),
      buildContext: (arg0: { input: { transaction: Uint8Array } }) =>
        new GetTokenPayloadsTask({
          contextModule,
          transaction: arg0.input.transaction,
        }).run(),
      provideContact: (arg0: {
        input: {
          transaction: Uint8Array;
          appConfig: AppConfiguration | null;
        };
      }) =>
        new ProvideContactTask(internalApi, {
          addressBook,
          transaction: arg0.input.transaction,
          appConfig: arg0.input.appConfig,
        }).run(),
      signTransaction: (arg0: {
        input: { transaction: Uint8Array; tokenPayloads: Uint8Array[] };
      }) =>
        new SignTransactionTask(internalApi, {
          derivationPath,
          transaction: arg0.input.transaction,
          tokenPayloads: arg0.input.tokenPayloads,
        }).run(),
    };
  }
}
