import {
  type ClearSignContextSuccess,
  type ContextModule,
} from "@ledgerhq/context-module";
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
import { type AppConfig } from "@api/model/AppConfig";
import { type Curve } from "@api/model/Curve";
import { type Signature } from "@api/model/Signature";
import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { BuildMptContextTask } from "@internal/app-binder/task/BuildMptContextTask";
import { ProvideMptContextTask } from "@internal/app-binder/task/ProvideMptContextTask";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";
import { isXrpSignerFeatureSupported } from "@internal/app-binder/XrpApplicationResolver";

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<CommandResult<AppConfig, XrpErrorCodes>>;
  readonly buildContext: (arg0: {
    input: {
      contextModule: ContextModule;
      transaction: Uint8Array;
    };
  }) => Promise<ClearSignContextSuccess[]>;
  readonly provideContext: (arg0: {
    input: { contexts: ClearSignContextSuccess[] };
  }) => Promise<void>;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      transaction: Uint8Array;
      curve: Curve;
    };
  }) => Promise<CommandResult<Signature, XrpErrorCodes>>;
};

/**
 * Opens the XRP app (unless skipped), gives it the MPT descriptors of the
 * transaction, then runs {@link SendSignTransactionTask}.
 *
 * Unlike `CallTaskInAppDeviceAction`, the serialized transaction is not closed
 * over a task. It lives on machine `context.input.transaction` and can be
 * supplied from either source:
 * - factory / constructor args (direct `executeDeviceAction`);
 * - parent invoke `input` when this DA is nested via `makeStateMachine`.
 *
 * No descriptor step fails the signature: without a descriptor, the app shows
 * the transaction without the ticker, or blind signs it.
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

    const { getAppConfig, buildContext, provideContext, signTransaction } =
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
        provideContext: fromPromise(provideContext),
        signTransaction: fromPromise(signTransaction),
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
      },
      guards: {
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        isMptSupported: ({ context }) =>
          context._internalState.appConfig !== null &&
          isXrpSignerFeatureSupported(
            internalApi,
            "mpt",
            context._internalState.appConfig,
          ),
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: ({
            context,
            event,
          }): SignTransactionDAInternalState => {
            const eventError: unknown = (event as { error?: unknown }).error;
            return {
              ...context._internalState,
              error: new UnknownDAError(
                eventError instanceof Error
                  ? eventError.message
                  : String(eventError),
              ),
            };
          },
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
          contexts: [],
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
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
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
              target: "CheckMptSupported",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  appConfig: isSuccessCommandResult(event.output)
                    ? event.output.data
                    : null,
                }),
              }),
            },
            onError: { target: "CheckMptSupported" },
          },
        },
        // The XRP app takes MPT descriptors from 2.9.0. An older one still gets
        // the transaction, without them.
        CheckMptSupported: {
          always: [
            { target: "BuildContext", guard: "isMptSupported" },
            "SignTransaction",
          ],
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
              contextModule: context.input.contextModule,
              transaction: context.input.transaction,
            }),
            onDone: {
              target: "ProvideContext",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  contexts: event.output,
                }),
              }),
            },
            onError: { target: "SignTransaction" },
          },
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.PROVIDE_CONTEXT,
            },
          }),
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) => ({
              contexts: context._internalState.contexts,
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
            // Always from context.input (seeded by factory args or invoke input).
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              curve: context.input.curve,
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
                    : {
                        ...context._internalState,
                        error: event.output.error,
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
    const loggerFactory =
      this.input.loggerFactory ?? this.getLoggerFactory(internalApi);

    return {
      getAppConfig: () => internalApi.sendCommand(new GetAppConfigCommand()),
      buildContext: ({ input }) =>
        new BuildMptContextTask({
          ...input,
          deviceModelId: internalApi.getDeviceSessionState().deviceModelId,
        }).run(),
      provideContext: ({ input }) =>
        new ProvideMptContextTask(internalApi, input).run(),
      signTransaction: ({
        input,
      }: {
        input: {
          derivationPath: string;
          transaction: Uint8Array;
          curve: Curve;
        };
      }) => {
        // context.input.transaction is seeded by factory args or invoke input;
        // reject the factory default / missing bytes before hitting the device.
        if (!input.transaction?.length) {
          return Promise.reject(
            new UnknownDAError(
              "SignTransactionDeviceAction requires a non-empty serialized transaction (factory arg or invoke/context input)",
            ),
          );
        }

        return new SendSignTransactionTask(internalApi, {
          derivationPath: input.derivationPath,
          serializedTransaction: input.transaction,
          curve: input.curve,
          loggerFactory,
        }).run();
      },
    };
  }
}
