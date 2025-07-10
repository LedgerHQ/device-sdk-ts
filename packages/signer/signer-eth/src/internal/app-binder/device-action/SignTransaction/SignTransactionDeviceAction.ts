import {
  type ClearSignContextSuccess,
  type ContextModule,
} from "@ledgerhq/context-module";
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
import { and, assign, fromPromise, setup } from "xstate";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionType } from "@api/model/TransactionType";
import { GetAppConfiguration } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import {
  Web3CheckOptInCommand,
  type Web3CheckOptInCommandResponse,
} from "@internal/app-binder/command/Web3CheckOptInCommand";
import {
  BuildTransactionContextTask,
  type BuildTransactionContextTaskArgs,
  type BuildTransactionTaskResult,
} from "@internal/app-binder/task/BuildTransactionContextTask";
import { ProvideTransactionContextTask } from "@internal/app-binder/task/ProvideTransactionContextTask";
import {
  type GenericContext,
  ProvideTransactionGenericContextTask,
  type ProvideTransactionGenericContextTaskErrorCodes,
} from "@internal/app-binder/task/ProvideTransactionGenericContextTask";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<GetConfigCommandResponse, EthErrorCodes>
  >;
  readonly web3CheckOptIn: () => Promise<
    CommandResult<Web3CheckOptInCommandResponse, EthErrorCodes>
  >;
  readonly buildContext: (arg0: {
    input: {
      contextModule: ContextModule;
      mapper: TransactionMapperService;
      transaction: Uint8Array;
      options: TransactionOptions;
      appConfig: GetConfigCommandResponse;
      derivationPath: string;
    };
  }) => Promise<BuildTransactionTaskResult>;
  readonly provideContext: (arg0: {
    input: {
      clearSignContexts: ClearSignContextSuccess[];
    };
  }) => Promise<Maybe<CommandErrorResult<EthErrorCodes>>>;
  readonly provideGenericContext: (arg0: {
    input: {
      contextModule: ContextModule;
      transactionParser: TransactionParserService;
      chainId: number;
      derivationPath: string;
      serializedTransaction: Uint8Array;
      context: GenericContext;
    };
  }) => Promise<
    Maybe<CommandErrorResult<ProvideTransactionGenericContextTaskErrorCodes>>
  >;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      chainId: number;
      transactionType: TransactionType;
      isLegacy: boolean;
    };
  }) => Promise<CommandResult<Signature, EthErrorCodes>>;
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
      getAppConfig,
      web3CheckOptIn,
      buildContext,
      provideContext,
      provideGenericContext,
      signTransaction,
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
        getAppConfig: fromPromise(getAppConfig),
        web3CheckOptIn: fromPromise(web3CheckOptIn),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        provideGenericContext: fromPromise(provideGenericContext),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        isGenericContext: ({ context }) =>
          context._internalState.clearSignContexts !== null &&
          typeof (context._internalState.clearSignContexts as GenericContext)
            .transactionInfo === "string",
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
        skipOpenApp: ({ context }) => !!context.input.options.skipOpenApp,
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoB5ABzA2Y8etBk1bkqAYghUwHVBjoUA1nIp8BQ5KTykwAWRIALBWADaABgC6iUDwqxUEjLZAAPRABYAzAHYOAJwAHACMAb4ArBYWAEw+FkHeADQgAJ6IwRYcAGwRQUG52TF5EcUAvmUpaJi4BERsVCKMLA2cAMJGYMTKvPyCwvTN4uwASnAArgA2pJKWNkgg9o7Orh4IAcEcpRYhvonZAd4byWmIITtZESEhBTHeEVH33hVV6Nj4hCTOTWKtHB1dHoafo-FrOMawKYzMwheZ2BxOdirDKbba7faHY4pdIIUIcG6+bwWbKeXwxIKeTzkl4garvOpfdig4ZUDgAcTApA6eEmk34MGksnkihUchgXKMPL5GBgc1cS0RVGRCBCngC2Q4aqCewCEWyQUyJxx5x2HBiByCsV8AQsaoinhpdNqn1azL+HIlUv5YEkYBwOAoOA4PEmugAZoGALYccXc3neuULBUrBZrVXqzXBHV6g2Wo1nDaasIWXxkwkxW0xXyOt7O+rfQa-Zzszlx6UwCFQgHdWbWeUIlOgNMBTxBDiJby3MkmiK+bFnCzeEL4mLm4m5aLeB2VWm1j71pmNsHsFue+MysCd6bd5SzWH95ZI1MF0fj7yTorT6Kz+cILfLhJEgiDZslVXwLACGsan3RlGiPFlOAAIXGVBJggNoqD0NwZhkDA5AUJRVA4AAjFC0IwjAsNIRN4UfJVnwQOJPCyIJyWLHYqV1bJf3OGJl3yYlfFA0dsiOZ4dydGDXXgv5kNQ9DMLAbDfX9QNg1DUgIxwaNSPkiiqJoxYByfIdECYli2JtDiYi439PGAjhvArVdrT4skDm3V5oIZaTRGPVk5PIxTsKvCVAV7OEjLolwGPJfJMwrUkjkiNUeIsK4OEJLdLWiUI9ig+kXQbPyEI4QKFMopTSFCm870i5MTPcMz8jHNVEsJcJ7QCX88pySJSlKPw7jCAq61gmgZObAAFAMGAgMB9KqwU8OFQi5B4WbUHmxbsMMhr6NMv9RzHFK8kiLdBu405cQSTV32Ym5slAw4YlGqTiqGP4ZooOaFuCmY-QDIMQ3DKNg027b-r24yDqao74tO7UIguu4rpxbJokCA0rmJCDjk83dvKKw8Sq+iGwA5PCcEYHacKFAjRXBn6top-g-RpqG+yTGGYsO7KTvtM7kfs1HfyszLfDCbIySpdzxK8wqDzg0npvJyn2eIWmVKB9TQe0pnfvV6nNc5+qeeVfnMsFpGUe8NGF3snI8liViQlEolIIkvcfI+psT0kn32GW-CRSIxwiaVjBoei5VmL2M1SSCB4KyTykIh6wtDgKcJJbyAIRq9iPxrdZsA+JqRAbUkHNLB8PFfG6PFV5uG47HOI9mThJ7Xs39fCpJ3tRe4JzTewPlc+0vvfLjAas6HtG8HFuuo4YldiXOJQgpdProCGzMvz-VOOYuPR+nkv-anyPZ-CmEzZjhj7LVFfQMJEIN5uHvrvyTxHPJEtgIKKUXIFQdwYAoPNeACwy6R3PrDfazc1gAFp7YIGQSvaIGDMEYNnKfGBk0Ty9E0AMFWjV4GxxiGLPUCc9SlGCKBSsuDi74NZDeQhIJmEzwmNMB8TdlT6n8HxEIeoP5kichQ66JoYgrzytjDBk5qyF3rr5CeJ4PRtm9DwxeaYbhjkHtla0dtRJzh3knfEs53wbHztaHwjDlF+1ZGoyU54OxcLCt0TRjU0zgW8IECCrF872Q2PaNKq4ci7yeuSPINxqSKLGnY-ySEyIVSoh42Gaw+JHHxIcaIGxOIlnzCqb8mV9QZK3McJOtjfYJLKkk2m193Hc3vodc0r47i7xssBEIS40o+EcouZGRQ3ZOSepUkmKjWTfV+rTVJCDEBLicpqAoeYUqLm6tdVyv9JHaiOPnUZ497GcEmSzI2HNKrYRmRbCCUjSzmjfsjCshw0pu3HK5aWfdbSeBGbE96YyDkcGgeNC5DE-DMRXl080fdKShDWTiCkAR8QHDCLsG05JyjfLHhNEhrIAWtHqcoIFh0qSmNyPkEcHc9Riz4o5UCDx3ZbiXBEPZmLxmcGQOMYgTBYCQNorwh+Ql4VUgSD4J6uRPAhEpRqWhYRjoXCCEy2BnAACiqkcAEpbvyzUKdhVPXtOK66oExwY3VEI1Ffhd4gLKEAA */
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
            step: SignTransactionDAStep.OPEN_APP,
          },
          _internalState: {
            error: null,
            appConfig: null,
            clearSignContexts: null,
            serializedTransaction: null,
            chainId: null,
            web3Check: null,
            transactionType: null,
            isLegacy: true,
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
                  step: SignTransactionDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<SignTransactionDAInternalState>({
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
              step: SignTransactionDAStep.GET_APP_CONFIG,
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
              target: "BuildContext",
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
              step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN,
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
              step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN_RESULT,
              result: context._internalState.appConfig!.web3ChecksEnabled,
            },
          })),
          // Using after transition to force a snapshot of the state after the entry action
          // This ensures the intermediateValue is captured before moving to BuildContext
          after: {
            0: {
              target: "BuildContext",
            },
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
              contextModule: context.input.contextModule,
              mapper: context.input.mapper,
              transaction: context.input.transaction,
              options: context.input.options,
              appConfig: context._internalState.appConfig!,
              derivationPath: context.input.derivationPath,
            }),
            onDone: {
              target: "BuildContextResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    clearSignContexts: event.output.clearSignContexts!,
                    serializedTransaction: event.output.serializedTransaction,
                    chainId: event.output.chainId,
                    transactionType: event.output.transactionType,
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
        BuildContextResultCheck: {
          always: [
            {
              target: "ProvideGenericContext",
              guard: "isGenericContext",
            },
            {
              target: "ProvideContext",
            },
          ],
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
              clearSignContexts: context._internalState
                .clearSignContexts as ClearSignContextSuccess[],
            }),
            onDone: {
              target: "SignTransaction",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideGenericContext: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.PROVIDE_GENERIC_CONTEXT,
            },
          }),
          invoke: {
            id: "provideGenericContext",
            src: "provideGenericContext",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              transactionParser: context.input.parser,
              chainId: context._internalState.chainId!,
              derivationPath: context.input.derivationPath,
              serializedTransaction:
                context._internalState.serializedTransaction!,
              context: context._internalState
                .clearSignContexts as GenericContext,
              web3Check: context._internalState.web3Check,
            }),
            onDone: {
              actions: assign({
                _internalState: ({ event, context }) => {
                  const { isLegacy: _, ...rest } = context._internalState;
                  return event.output.caseOf({
                    Just: () => ({
                      ...rest,
                      isLegacy: false,
                    }),
                    Nothing: () => ({
                      ...rest,
                      isLegacy: false,
                    }),
                  });
                },
              }),
              // NOTE: don't check errors to fallback to blind signing
              target: "SignTransaction",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
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
              derivationPath: context.input.derivationPath,
              serializedTransaction:
                context._internalState.serializedTransaction!,
              chainId: context._internalState.chainId!,
              transactionType: context._internalState.transactionType!,
              isLegacy: context._internalState.isLegacy,
            }),
            onDone: {
              target: "SignTransactionResultCheck",
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
        SignTransactionResultCheck: {
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
    const getAppConfig = async () =>
      internalApi.sendCommand(new GetAppConfiguration());
    const web3CheckOptIn = async () =>
      internalApi.sendCommand(new Web3CheckOptInCommand());
    const buildContext = async (arg0: {
      input: BuildTransactionContextTaskArgs;
    }) => new BuildTransactionContextTask(internalApi, arg0.input).run();

    const provideContext = async (arg0: {
      input: {
        clearSignContexts: ClearSignContextSuccess[];
      };
    }) =>
      new ProvideTransactionContextTask(internalApi, {
        clearSignContexts: arg0.input.clearSignContexts,
      }).run();

    const provideGenericContext = async (arg0: {
      input: {
        contextModule: ContextModule;
        transactionParser: TransactionParserService;
        chainId: number;
        derivationPath: string;
        serializedTransaction: Uint8Array;
        context: GenericContext;
      };
    }) =>
      new ProvideTransactionGenericContextTask(internalApi, {
        contextModule: arg0.input.contextModule,
        transactionParser: arg0.input.transactionParser,
        chainId: arg0.input.chainId,
        derivationPath: arg0.input.derivationPath,
        serializedTransaction: arg0.input.serializedTransaction,
        context: arg0.input.context,
      }).run();

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
        chainId: number;
        transactionType: TransactionType;
        isLegacy: boolean;
      };
    }) => new SendSignTransactionTask(internalApi, arg0.input).run();

    return {
      getAppConfig,
      web3CheckOptIn,
      buildContext,
      provideContext,
      provideGenericContext,
      signTransaction,
    };
  }
}
