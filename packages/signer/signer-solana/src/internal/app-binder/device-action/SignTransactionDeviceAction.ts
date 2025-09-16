import {
  type CommandErrorResult,
  type CommandResult,
  type DeviceActionStateMachine,
  DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, type Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { ApplicationChecker } from "@internal/app-binder/services/ApplicationChecker";
import {
  SolanaTransactionTypes,
  TransactionInspector,
} from "@internal/app-binder/services/TransactionInspector";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";
import {
  BuildTransactionContextTask,
  type BuildTransactionContextTaskArgs,
  type SolanaBuildContextResult,
} from "@internal/app-binder/task/BuildTransactionContextTask";
import {
  ProvideSolanaTransactionContextTask,
  type SolanaContextForDevice,
} from "@internal/app-binder/task/ProvideTransactionContextTask";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<AppConfiguration, SolanaAppErrorCodes>
  >;
  readonly buildContext: (arg0: {
    input: BuildTransactionContextTaskArgs;
  }) => Promise<SolanaBuildContextResult>;
  readonly provideContext: (arg0: {
    input: SolanaContextForDevice;
  }) => Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>>;
  readonly inspectTransaction: (arg0: {
    serializedTransaction: Uint8Array;
    resolutionContext?: TransactionResolutionContext;
  }) => Promise<TxInspectorResult>;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
    };
  }) => Promise<
    CommandResult<Maybe<Signature | SolanaAppErrorCodes>, SolanaAppErrorCodes>
  >;
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

    const {
      signTransaction,
      getAppConfig,
      buildContext,
      provideContext,
      inspectTransaction,
    } = this.extractDependencies(internalApi);

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

        getAppConfig: fromPromise(getAppConfig),
        inspectTransaction: fromPromise(
          ({
            input,
          }: {
            input: {
              serializedTransaction: Uint8Array;
              resolutionContext?: TransactionResolutionContext;
            };
          }) =>
            inspectTransaction({
              serializedTransaction: input.serializedTransaction,
              resolutionContext: input.resolutionContext,
            }),
        ),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        isSPLSupported: ({ context }) =>
          new ApplicationChecker(
            internalApi.getDeviceSessionState(),
            context._internalState.appConfig!,
          )
            .withMinVersionExclusive("1.4.0")
            .excludeDeviceModel(DeviceModelId.NANO_S)
            .check(),
        isAnSPLTransaction: ({ context }) =>
          context._internalState.inspectorResult?.transactionType ===
          SolanaTransactionTypes.SPL,
        shouldSkipInspection: ({ context }) =>
          context._internalState.error === null &&
          !!context.input.resolutionContext,
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
        },
        _internalState: {
          error: null,
          signature: null,
          appConfig: null,
          solanaTransactionContext: null,
          inspectorResult: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "GetAppConfig", guard: "skipOpenApp" },
            { target: "OpenAppDeviceAction" },
          ],
        },
        OpenAppDeviceAction: {
          exit: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName: "Solana" }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "CheckOpenAppDeviceActionResult",
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
        CheckOpenAppDeviceActionResult: {
          always: [
            { target: "GetAppConfig", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        GetAppConfig: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "getAppConfig",
            src: "getAppConfig",
            onDone: {
              target: "GetAppConfigResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        appConfig: event.output.data,
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
        GetAppConfigResultCheck: {
          always: [
            { target: "InspectTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        InspectTransaction: {
          invoke: {
            id: "inspectTransaction",
            src: "inspectTransaction",

            input: ({ context }) => ({
              serializedTransaction: context.input.transaction,
              resolutionContext: context.input.resolutionContext,
            }),
            onDone: {
              target: "AfterInspect",
              actions: assign({
                _internalState: ({ context, event }) => ({
                  ...context._internalState,
                  inspectorResult: event.output,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        AfterInspect: {
          always: [
            { target: "BuildContext", guard: "isAnSPLTransaction" },
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        BuildContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "buildContext",
            src: "buildContext",
            input: ({ context }) => {
              const inspectorData =
                context._internalState.inspectorResult?.data;
              return {
                contextModule: context.input.contextModule,
                options: {
                  tokenAddress: inspectorData?.tokenAddress,
                  createATA: inspectorData?.createATA,
                },
              };
            },
            onDone: {
              target: "ProvideContext",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    solanaTransactionContext: {
                      descriptor: event.output.descriptor,
                      certificate: event.output.calCertificate,
                      tokenAccount: event.output.addressResult.tokenAccount,
                      owner: event.output.addressResult.owner,
                      contract: event.output.addressResult.contract,
                    },
                  }),
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) => {
              if (!context._internalState.solanaTransactionContext) {
                throw new UnknownDAError(
                  "Solana transaction context is not available",
                );
              }
              return context._internalState.solanaTransactionContext;
            },
            onDone: {
              target: "ProvideContextResultCheck",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideContextResultCheck: {
          always: [
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        SignTransaction: {
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
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => {
              return {
                derivationPath: context.input.derivationPath,
                serializedTransaction: context.input.transaction,
              };
            },
            onDone: {
              target: "SignTransactionResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (!isSuccessCommandResult(event.output))
                      return {
                        ...context._internalState,
                        error: event.output.error,
                      };

                    const data = event.output.data.extract();
                    if (
                      event.output.data.isJust() &&
                      data instanceof Uint8Array
                    )
                      return {
                        ...context._internalState,
                        signature: data,
                      };

                    return {
                      ...context._internalState,
                      error: new UnknownDAError("No Signature available"),
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
                new UnknownDAError(`No error or signature available`),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppConfig = async () =>
      internalApi.sendCommand(new GetAppConfigurationCommand());

    const buildContext = async (arg0: {
      input: BuildTransactionContextTaskArgs;
    }) => new BuildTransactionContextTask(internalApi, arg0.input).run();

    const provideContext = async (arg0: { input: SolanaContextForDevice }) =>
      new ProvideSolanaTransactionContextTask(internalApi, arg0.input).run();

    const inspectTransaction = async (arg0: {
      serializedTransaction: Uint8Array;
      resolutionContext?: TransactionResolutionContext;
    }) =>
      Promise.resolve(
        new TransactionInspector(
          arg0.serializedTransaction,
          arg0.resolutionContext?.tokenAddress ?? null,
          arg0.resolutionContext?.createATA ?? null,
        ).inspectTransactionType(),
      );

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
      };
    }) =>
      new SignDataTask(internalApi, {
        commandFactory: (args) =>
          new SignTransactionCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
      }).run();

    return {
      getAppConfig,
      buildContext,
      provideContext,
      signTransaction,
      inspectTransaction,
    };
  }
}
