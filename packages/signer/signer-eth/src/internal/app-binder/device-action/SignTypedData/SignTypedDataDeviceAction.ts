import { type ContextModule } from "@ledgerhq/context-module";
import {
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
import { Left, Nothing, Right } from "purify-ts";
import { and, assign, fromPromise, setup } from "xstate";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";
import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import {
  type SignTypedDataDAError,
  type SignTypedDataDAInput,
  type SignTypedDataDAIntermediateValue,
  type SignTypedDataDAInternalState,
  type SignTypedDataDAOutput,
  SignTypedDataDAStateStep,
} from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetAppConfiguration } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignEIP712Command } from "@internal/app-binder/command/SignEIP712Command";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import {
  Web3CheckOptInCommand,
  type Web3CheckOptInCommandResponse,
} from "@internal/app-binder/command/Web3CheckOptInCommand";
import { BuildEIP712ContextTask } from "@internal/app-binder/task/BuildEIP712ContextTask";
import {
  ProvideEIP712ContextTask,
  type ProvideEIP712ContextTaskArgs,
  type ProvideEIP712ContextTaskReturnType,
} from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { SignTypedDataLegacyTask } from "@internal/app-binder/task/SignTypedDataLegacyTask";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export type MachineDependencies = {
  readonly getAddress: (arg0: {
    input: GetAddressCommandArgs;
  }) => Promise<CommandResult<GetAddressCommandResponse, EthErrorCodes>>;
  readonly getAppConfig: () => Promise<
    CommandResult<GetConfigCommandResponse, EthErrorCodes>
  >;
  readonly web3CheckOptIn: () => Promise<
    CommandResult<Web3CheckOptInCommandResponse, EthErrorCodes>
  >;
  readonly buildContext: (arg0: {
    input: {
      contextModule: ContextModule;
      parser: TypedDataParserService;
      data: TypedData;
      appConfig: GetConfigCommandResponse;
      derivationPath: string;
      transactionMapper: TransactionMapperService;
      transactionParser: TransactionParserService;
      from: string;
    };
  }) => Promise<ProvideEIP712ContextTaskArgs>;
  readonly provideContext: (arg0: {
    input: {
      contextModule: ContextModule;
      taskArgs: ProvideEIP712ContextTaskArgs;
    };
  }) => ProvideEIP712ContextTaskReturnType;
  readonly signTypedData: (arg0: {
    input: {
      derivationPath: string;
    };
  }) => Promise<CommandResult<Signature, EthErrorCodes>>;
  readonly signTypedDataLegacy: (arg0: {
    input: {
      derivationPath: string;
      data: TypedData;
    };
  }) => Promise<CommandResult<Signature, EthErrorCodes>>;
};

export class SignTypedDataDeviceAction extends XStateDeviceAction<
  SignTypedDataDAOutput,
  SignTypedDataDAInput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue,
  SignTypedDataDAInternalState
> {
  private readonly _loggerFactory: (tag: string) => LoggerPublisherService;

  constructor(args: {
    input: SignTypedDataDAInput;
    inspect?: boolean;
    loggerFactory: (tag: string) => LoggerPublisherService;
  }) {
    super({
      input: args.input,
      inspect: args.inspect,
      logger: args.loggerFactory("SignTypedDataDeviceAction"),
    });
    this._loggerFactory = args.loggerFactory;
  }

  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTypedDataDAOutput,
    SignTypedDataDAInput,
    SignTypedDataDAError,
    SignTypedDataDAIntermediateValue,
    SignTypedDataDAInternalState
  > {
    type types = StateMachineTypes<
      SignTypedDataDAOutput,
      SignTypedDataDAInput,
      SignTypedDataDAError,
      SignTypedDataDAIntermediateValue,
      SignTypedDataDAInternalState
    >;

    const {
      getAddress,
      getAppConfig,
      web3CheckOptIn,
      buildContext,
      provideContext,
      signTypedData,
      signTypedDataLegacy,
    } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Ethereum" },
        }).makeStateMachine(internalApi),
        getAddress: fromPromise(getAddress),
        getAppConfig: fromPromise(getAppConfig),
        web3CheckOptIn: fromPromise(web3CheckOptIn),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signTypedData: fromPromise(signTypedData),
        signTypedDataLegacy: fromPromise(signTypedDataLegacy),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        notRefusedByUser: ({ context }) =>
          context._internalState.error !== null &&
          (!("errorCode" in context._internalState.error) ||
            context._internalState.error.errorCode !== "6985"),
        isWeb3ChecksSupported: ({ context }) =>
          new ApplicationChecker(
            internalApi.getDeviceSessionState(),
            context._internalState.appConfig!,
          )
            .withMinVersionExclusive("1.15.0")
            .excludeDeviceModel(DeviceModelId.NANO_S)
            .excludeDeviceModel(DeviceModelId.NANO_SP)
            .excludeDeviceModel(DeviceModelId.NANO_X)
            .check(),
        shouldOptIn: ({ context }) =>
          !context._internalState.appConfig!.web3ChecksEnabled &&
          !context._internalState.appConfig!.web3ChecksOptIn,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
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
      id: "SignTypedDataDeviceAction",
      initial: "InitialState",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: SignTypedDataDAStateStep.OPEN_APP,
          },
          _internalState: {
            error: null,
            appConfig: null,
            from: null,
            typedDataContext: null,
            signature: null,
          },
        };
      },
      states: {
        InitialState: {
          always: [
            {
              target: "GetAppConfig",
              guard: "skipOpenApp",
            },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: {
              appName: "Ethereum",
            },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: SignTypedDataDAStateStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<SignTypedDataDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "GetAppConfig",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        GetAppConfig: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTypedDataDAStateStep.GET_APP_CONFIG,
            },
          }),
          invoke: {
            id: "getAppConfig",
            src: "getAppConfig",
            onDone: {
              target: "GetAppConfigResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        appConfig: event.output.data,
                      };
                    } else {
                      return {
                        ...context._internalState,
                        error: event.output.error,
                      };
                    }
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
        GetAppConfigResultCheck: {
          always: [
            {
              target: "Web3ChecksOptIn",
              guard: and([
                "noInternalError",
                "isWeb3ChecksSupported",
                "shouldOptIn",
              ]),
            },
            {
              target: "GetAddress",
              guard: "noInternalError",
            },
            {
              target: "Error",
            },
          ],
        },
        Web3ChecksOptIn: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
              step: SignTypedDataDAStateStep.WEB3_CHECKS_OPT_IN,
            },
          }),
          invoke: {
            id: "web3CheckOptIn",
            src: "web3CheckOptIn",
            onDone: {
              target: "Web3ChecksOptInResult",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        appConfig: {
                          ...context._internalState.appConfig!,
                          web3ChecksEnabled: event.output.data.enabled,
                        },
                      };
                    } else {
                      return context._internalState;
                    }
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
        Web3ChecksOptInResult: {
          entry: assign(({ context }) => ({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTypedDataDAStateStep.WEB3_CHECKS_OPT_IN_RESULT,
              result: context._internalState.appConfig!.web3ChecksEnabled,
            },
          })),
          // Using after transition to force a snapshot of the state after the entry action
          // This ensures the intermediateValue is captured before moving to BuildContext
          after: {
            0: {
              target: "GetAddress",
            },
          },
        },
        GetAddress: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTypedDataDAStateStep.GET_ADDRESS,
            },
          }),
          invoke: {
            id: "getAddress",
            src: "getAddress",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
            }),
            onDone: {
              target: "BuildContext",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        from: event.output.data.address,
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
            },
          },
        },
        BuildContext: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTypedDataDAStateStep.BUILD_CONTEXT,
            },
          }),
          invoke: {
            id: "buildContext",
            src: "buildContext",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              parser: context.input.parser,
              transactionParser: context.input.transactionParser,
              transactionMapper: context.input.transactionMapper,
              data: context.input.data,
              appConfig: context._internalState.appConfig!,
              derivationPath: context.input.derivationPath,
              from: context._internalState.from!,
            }),
            onDone: {
              target: "ProvideContext",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    typedDataContext: event.output,
                  }),
                }),
              ],
            },
            onError: {
              target: "SignTypedDataLegacy",
            },
          },
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
              step: SignTypedDataDAStateStep.PROVIDE_CONTEXT,
            },
          }),
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              taskArgs: context._internalState.typedDataContext!,
            }),
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return _.context._internalState;
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
                  };
                },
              }),
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
            { guard: "noInternalError", target: "SignTypedData" },
            { guard: "notRefusedByUser", target: "SignTypedDataLegacy" },
            { target: "Error" },
          ],
        },
        SignTypedData: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
              step: SignTypedDataDAStateStep.SIGN_TYPED_DATA,
            },
          }),
          invoke: {
            id: "signTypedData",
            src: "signTypedData",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
            }),
            onDone: {
              target: "SignTypedDataResultCheck",
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
        SignTypedDataResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { guard: "notRefusedByUser", target: "SignTypedDataLegacy" },
            { target: "Error" },
          ],
        },
        SignTypedDataLegacy: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
              step: SignTypedDataDAStateStep.SIGN_TYPED_DATA_LEGACY,
            },
          }),
          invoke: {
            id: "signTypedDataLegacy",
            src: "signTypedDataLegacy",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              data: context.input.data,
            }),
            onDone: {
              target: "SignTypedDataLegacyResultCheck",
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
        SignTypedDataLegacyResultCheck: {
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
    const getAddress = async (arg0: { input: GetAddressCommandArgs }) =>
      internalApi.sendCommand(new GetAddressCommand(arg0.input));
    const getAppConfig = async () =>
      internalApi.sendCommand(new GetAppConfiguration());
    const web3CheckOptIn = async () =>
      internalApi.sendCommand(new Web3CheckOptInCommand());
    const buildContext = async (arg0: {
      input: {
        contextModule: ContextModule;
        parser: TypedDataParserService;
        data: TypedData;
        appConfig: GetConfigCommandResponse;
        derivationPath: string;
        transactionMapper: TransactionMapperService;
        transactionParser: TransactionParserService;
        from: string;
      };
    }) =>
      new BuildEIP712ContextTask(
        internalApi,
        arg0.input.contextModule,
        arg0.input.parser,
        arg0.input.transactionParser,
        arg0.input.transactionMapper,
        arg0.input.data,
        arg0.input.derivationPath,
        arg0.input.appConfig,
        arg0.input.from,
        this._loggerFactory("BuildEIP712ContextTask"),
      ).run();

    const provideContext = async (arg0: {
      input: {
        contextModule: ContextModule;
        taskArgs: ProvideEIP712ContextTaskArgs;
      };
    }) =>
      new ProvideEIP712ContextTask(
        internalApi,
        arg0.input.contextModule,
        arg0.input.taskArgs,
      ).run();

    const signTypedData = async (arg0: {
      input: {
        derivationPath: string;
      };
    }): Promise<CommandResult<Signature, EthErrorCodes>> =>
      internalApi.sendCommand(
        new SignEIP712Command({
          derivationPath: arg0.input.derivationPath,
          legacyArgs: Nothing,
        }),
      );

    const signTypedDataLegacy = async (arg0: {
      input: {
        derivationPath: string;
        data: TypedData;
      };
    }) =>
      new SignTypedDataLegacyTask(
        internalApi,
        arg0.input.data,
        arg0.input.derivationPath,
        this._loggerFactory("SignTypedDataLegacyTask"),
      ).run();

    return {
      getAddress,
      getAppConfig,
      web3CheckOptIn,
      buildContext,
      provideContext,
      signTypedData,
      signTypedDataLegacy,
    };
  }
}
