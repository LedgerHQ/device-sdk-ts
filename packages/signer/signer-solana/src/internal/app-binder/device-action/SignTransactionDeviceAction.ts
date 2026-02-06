import {
  type CommandErrorResult,
  type CommandResult,
  type DeviceActionStateMachine,
  DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
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
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import {
  type TransactionResolutionContext,
  type UserInputType,
} from "@api/model/TransactionResolutionContext";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { ApplicationChecker } from "@internal/app-binder/services/ApplicationChecker";
import {
  BlindSignReason,
  computeSigningContext,
} from "@internal/app-binder/services/computeSigningContext";
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
  type ProvideSolanaTransactionContextTaskArgs,
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
    input: ProvideSolanaTransactionContextTaskArgs;
  }) => Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>>;
  readonly inspectTransaction: (arg0: {
    serializedTransaction: Uint8Array;
    resolutionContext?: TransactionResolutionContext;
    rpcUrl?: string;
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
  private readonly _loggerFactory: (tag: string) => LoggerPublisherService;

  constructor(args: {
    input: SignTransactionDAInput;
    inspect?: boolean;
    loggerFactory: (tag: string) => LoggerPublisherService;
  }) {
    super({
      input: args.input,
      inspect: args.inspect,
      logger: args.loggerFactory("SignTransactionDeviceAction"),
    });
    this._loggerFactory = args.loggerFactory;
  }

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
              rpcUrl?: string;
            };
          }) =>
            inspectTransaction({
              serializedTransaction: input.serializedTransaction,
              resolutionContext: input.resolutionContext,
              rpcUrl: input.rpcUrl,
            }),
        ),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) =>
          context.input.transactionOptions?.skipOpenApp || false,
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
          !!context.input.transactionOptions?.transactionResolutionContext,
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EAJgCMADg4BWAGw7jAGhABPRHr3SA7Bx0BONwGYALNOPfvUz1jHQBfUOs0TFwCIjYqWgYmVnIqbl5+IRExKT15JBBlVVSMDW0EfSMzC2s7BDdvHQ5pby9ff0DgsIiQKOx8QhISxMYWeM4AeUUwDGZFRRHk8fEIKjAOVAw6CgBrdYpp2fnhUTAAWRIAC02wGXylFTUqMsQnN1MON2lzK1tEN0MJicOicTlMoM8LXe4Ui6H6sSG7EWYxKHAAwpcwMQdlMZnMFvRRil2AAlOAAVwEpCkcg0RSepQK5T0nmMRmkwR+tX+3iMgVM0mc+j0OgM3Vh0QGcWGhKWqIxWJxh3xyOJVDJsEp1MkeTpjxKLwQLLZzU5NT+CAMeg4rTcBneLN8bx8MN6cJig3GqvGHAA4mBSPi0VQAGboFZrDZbXbrGCB+bBjBhqB3PXFdRM+wGUzeVymaq-OqOMWfe0BHyeNxOPSmV19D3SpGylHsP0BoOh8NgHA4Cg4DiKASiEN9gC2HDjHaT6FTBXpBszRuzuZ0+a5Fr0Hk+HjL2YsLNMtZ69aliISzbVnH98cUieTGq1CuxNPuhX1GdA5R0nh0TRapgMJxC3sBwmgMMVwU8QC3l5Yw63dU8vQvH1ryne8KSpJ8dlyV95w-LRdB-P9AkA4CEB8a0qxzYwnE8H5jW8eDJQRJCkhbNIeFgaYyAbM8MAjDB1k2bY9ijLisVIXjxlnB502eRdRS+Dgc2+c0i2kBoODBUUDA0ytqyPCV4U9GU2MvdJxJ4xCSnEbte37QdhzHMTuMk6z2Bkt85MZT9dHtaRlN8dc6kCALvDBbwzA0jTwqApjjMbc8zJ9ZgQzEHBONcl80wZQ0fyCLIs4XwVFgjSFOr-XePkLS61vvfHuuc+5bhNsNc250AIT2 */
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
          appConfig: null,
          solanaTransactionContext: null,
          inspectorResult: null,
          signingContextInfo: null,
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
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.OPEN_APP,
            }),
          }),
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName: "Solana" }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) => ({
                  ...event.snapshot.context.intermediateValue,
                  step: signTransactionDAStateSteps.OPEN_APP,
                }),
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
              step: signTransactionDAStateSteps.GET_APP_CONFIG,
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
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
            }),
          }),
          invoke: {
            id: "inspectTransaction",
            src: "inspectTransaction",

            input: ({ context }) => ({
              serializedTransaction: context.input.transaction,
              resolutionContext:
                context.input.transactionOptions?.transactionResolutionContext,
              rpcUrl: context.input.transactionOptions?.solanaRPCURL,
            }),
            onDone: {
              target: "AfterInspect",
              actions: assign({
                _internalState: ({ context, event }) => ({
                  ...context._internalState,
                  inspectorResult: event.output,
                  signingContextInfo: computeSigningContext(event.output),
                }),
              }),
            },
            onError: {
              target: "SignTransaction",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                  signingContextInfo: {
                    isBlindSign: true,
                    reason: BlindSignReason.InspectionFailed,
                    programIds: [],
                    unrecognizedPrograms: [],
                    instructionCount: 0,
                  },
                }),
              }),
            },
          },
        },
        AfterInspect: {
          always: [
            { target: "BuildContext", guard: "isAnSPLTransaction" },
            { target: "SignTransaction" },
          ],
        },
        BuildContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.BUILD_TRANSACTION_CONTEXT,
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
                loggerFactory: this._loggerFactory,
                options: {
                  tokenAddress: inspectorData?.tokenAddress,
                  createATA: inspectorData?.createATA,
                  tokenInternalId:
                    context.input.transactionOptions
                      ?.transactionResolutionContext?.tokenInternalId,
                  templateId:
                    context.input.transactionOptions
                      ?.transactionResolutionContext?.templateId,
                },
              };
            },
            onDone: {
              target: "ProvideContext",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  solanaTransactionContext: {
                    tlvDescriptor: event.output.tlvDescriptor,
                    trustedNamePKICertificate:
                      event.output.trustedNamePKICertificate,
                    loadersResults: event.output.loadersResults,
                  },
                }),
              }),
            },
            onError: {
              target: "SignTransaction",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                  signingContextInfo: context._internalState.signingContextInfo
                    ? {
                        ...context._internalState.signingContextInfo,
                        isBlindSign: true,
                        reason: BlindSignReason.ContextBuildFailed,
                      }
                    : null,
                }),
              }),
            },
          },
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.PROVIDE_TRANSACTION_CONTEXT,
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
              return {
                ...context._internalState.solanaTransactionContext,
                transactionBytes: context.input.transaction,
                loggerFactory: this._loggerFactory,
              };
            },
            onDone: {
              target: "SignTransaction",
              actions: assign({
                _internalState: ({ context }) => {
                  const currentInfo =
                    context._internalState.signingContextInfo;
                  // When instruction descriptors are successfully provided,
                  // the device uses process_message_body_with_descriptor()
                  // which bypasses the program whitelist check.
                  // Clear blind sign only if it was triggered by an
                  // unrecognized program — ALTs and instruction-count limits
                  // are structural and still apply.
                  if (
                    currentInfo?.reason ===
                    BlindSignReason.UnrecognizedProgram
                  ) {
                    return {
                      ...context._internalState,
                      signingContextInfo: {
                        ...currentInfo,
                        isBlindSign: false,
                        reason: BlindSignReason.None,
                      },
                    };
                  }
                  return context._internalState;
                },
              }),
            },
            onError: {
              target: "SignTransaction",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                  signingContextInfo: context._internalState.signingContextInfo
                    ? {
                        ...context._internalState.signingContextInfo,
                        isBlindSign: true,
                        reason: BlindSignReason.ContextProvisionFailed,
                      }
                    : null,
                }),
              }),
            },
          },
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: ({ context }) => ({
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signTransactionDAStateSteps.SIGN_TRANSACTION,
              signingContext: context._internalState.signingContextInfo ?? {
                isBlindSign: true,
                reason: BlindSignReason.InspectionFailed,
                programIds: [],
                unrecognizedPrograms: [],
                instructionCount: 0,
              },
            }),
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => {
              return {
                derivationPath: context.input.derivationPath,
                serializedTransaction: context.input.transaction,
                userInputType:
                  context.input.transactionOptions?.transactionResolutionContext
                    ?.userInputType,
              };
            },
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (!isSuccessCommandResult(event.output))
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };

                  const data = event.output.data.extract();
                  if (event.output.data.isJust() && data instanceof Uint8Array)
                    return {
                      ...context._internalState,
                      signature: data,
                    };

                  return {
                    ...context._internalState,
                    error: new UnknownDAError("No Signature available"),
                  };
                },
                intermediateValue: ({ context }) => ({
                  requiredUserInteraction: UserInteractionRequired.None,
                  step: signTransactionDAStateSteps.SIGN_TRANSACTION,
                  signingContext: context._internalState.signingContextInfo ?? {
                    isBlindSign: true,
                    reason: BlindSignReason.InspectionFailed,
                    programIds: [],
                    unrecognizedPrograms: [],
                    instructionCount: 0,
                  },
                }),
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

    const provideContext = async (arg0: {
      input: ProvideSolanaTransactionContextTaskArgs;
    }) =>
      new ProvideSolanaTransactionContextTask(internalApi, arg0.input).run();

    const inspectTransaction = async (arg0: {
      serializedTransaction: Uint8Array;
      resolutionContext?: TransactionResolutionContext;
      rpcUrl?: string;
    }) =>
      Promise.resolve(
        new TransactionInspector(arg0.rpcUrl).inspectTransactionType(
          arg0.serializedTransaction,
          arg0.resolutionContext?.tokenAddress,
          arg0.resolutionContext?.createATA,
        ),
      );

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
        userInputType?: UserInputType;
      };
    }) =>
      new SignDataTask(internalApi, {
        commandFactory: (args) =>
          new SignTransactionCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
            userInputType: arg0.input.userInputType,
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
