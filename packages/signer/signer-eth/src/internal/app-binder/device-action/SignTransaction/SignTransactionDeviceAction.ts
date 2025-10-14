import {
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
import { Left, Right } from "purify-ts";
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
import { ClearSigningType } from "@api/model/ClearSigningType";
import { type Signature } from "@api/model/Signature";
import { type TransactionType } from "@api/model/TransactionType";
import { GetAppConfiguration } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import {
  Web3CheckOptInCommand,
  type Web3CheckOptInCommandResponse,
} from "@internal/app-binder/command/Web3CheckOptInCommand";
import {
  BuildFullContextsTask,
  type BuildFullContextsTaskArgs,
  type BuildFullContextsTaskResult,
} from "@internal/app-binder/task/BuildFullContextsTask";
import {
  ParseTransactionTask,
  type ParseTransactionTaskArgs,
  type ParseTransactionTaskResult,
} from "@internal/app-binder/task/ParseTransactionTask";
import {
  ProvideTransactionContextsTask,
  type ProvideTransactionContextsTaskArgs,
  type ProvideTransactionContextsTaskResult,
} from "@internal/app-binder/task/ProvideTransactionContextsTask";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<GetConfigCommandResponse, EthErrorCodes>
  >;
  readonly web3CheckOptIn: () => Promise<
    CommandResult<Web3CheckOptInCommandResponse, EthErrorCodes>
  >;
  readonly parseTransaction: (arg0: {
    input: ParseTransactionTaskArgs;
  }) => Promise<ParseTransactionTaskResult>;
  readonly buildContexts: (arg0: {
    input: BuildFullContextsTaskArgs;
  }) => Promise<BuildFullContextsTaskResult>;
  readonly provideContexts: (arg0: {
    input: ProvideTransactionContextsTaskArgs;
  }) => Promise<ProvideTransactionContextsTaskResult>;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      chainId: number;
      transactionType: TransactionType;
      clearSigningType: ClearSigningType;
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
      parseTransaction,
      buildContexts,
      signTransaction,
      provideContexts,
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
        parseTransaction: fromPromise(parseTransaction),
        buildContexts: fromPromise(buildContexts),
        provideContexts: fromPromise(provideContexts),
        signTransaction: fromPromise(signTransaction),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EARgDsAZg4AOACzGAnAFYDNgGxXpF6ToA0IAJ67TOgEwcDHTsLCz9pQN9bAF8o9zRMXAIiNipaBiZWcipuXn4hETEpHXkkEGVVLIwNbQR9IzNLG3tHZzdPXV87aQ5I5ztfSON+zpi49Gx8QhJKtMYWFM4AeUUwDGZFRVmMhfEIKjAOVAw6CgBrA4oVtY3hUTAAWRIACyOwGRKlFTUqasQ9RxMVjMdgcdj0xnBvncXlqkTsHAsQxcnVMvmM4TsoxA8QmSWm7C280qHAAwk8wMRTstVutNvQ5pl2AAlOAAVwEpCkcg05W+VVKNR0gW6IOsoWMfgMdlMdmhHRBHActisFnMMqCmNi2PGiSmC0JjOyZIpVKutINCxZsHZnMkxR5X0qv1qwsVwRVOglcJlcoQEo4ns9pmkQL00mCFgMWJxuuSM3p22JAHEwKRaSSqAAzdC7faHY5nA4wNMbDMYbNQd4OirqAW6CVWDhWPR2fR2Yy+Fu+UwGX1C4zGHoGcPSDuGCx6HTRnWTOMEhNE9gcFMlxRliviMA4HAUHAcRQCUSZ3cAWw4xfTWfQVdKvKdddqDabLbbY-6Pb7IQ4I+sPdR1n+KMtRjWd8VSBdDU4FdL3LdArRtY1KS5D4ykdWtQBqAYO2-MFwyBHRTEjNoYT8Lpv3CKwrG7Zt0VMPRpwSUD9QghZl1TGCK3gjlENOIoULvdCtEQLD-HDMMHAlQjAj7VEdADENg1MYNhQMUwGNxPV43SRdsmg0srygLjSB4qRfH4tCfgfEScPE-CpOIxBVO6HQiLbVUQR8dTYzAmgWOJAB1MAACMDB42BllIHhcwwA4jhOc4OAAd2C0LyUpCKeBvT4a0sjDhKGfxmxDXwMT0SIDF7dpYUono9B7YxbAI4xHGMLymK0hlWMCkKwoyjBN23Xd90PUhjxwM9kp6tLTUijAstQnL+TyhA0X6Z9itK8rKphUwgW-MrfFCXpKJcejgJnPFmO0yCOG61KTXCxRZqM8RNFgAoDjwTMxBwAAKaQAEpxBAy6OsTJc7t6p6eCM+aBNyoSEAqgjFVIz0LE6CxWz0PtOz0Dg9HBMquh8LowTa0H52u1iAAU8BwWAwG8nY9hi-N4oORR6cZ5nKjhiylsRgxwQsJtCOlIIdFHaQWz7AwJ2-FyCMGEMMbOsZGMp8DqeJOmGaZ9r2AGnc9wPI9T33bmDa1ubuVvAXnWFywxax0mpfRWWqpVUWSqUgYw2F5xWvOzXNKpzriQAIVZVABAgMsxE0UhYGi2KCwSoKY7jhOwCT2B+cW50e09RUSshJwQ0nGSdEbKx-1bUI7IsCmw+1iOl2j2P46oRPk+NoazdGi3M67nO84Lvki8CQd+hljsK+bByEDq7oKocbtI3BOurBbuc2-B7IaZ3BgIDAMe+9ZtOOf3Y-UFP8-87t7LJ4fcwyqbbGezq-orFlKqCLIs4XwVFgjSFOr-XePkLS61vvfHuuc+5bhNsNc240b4UBPmfeB48n4LRfstN+hVP7CxlMAv+MIBxyRlAVSck5xSQKuu3bIINW79UvuzQsHBVChz3rbcyhcHx1xKhwVEwwQgV0nFYGSv8EQDCFD4GuehVQ7xDhpXh0ClwsN4f3U2I0xpnm4WonyE97zLSEd0URAxxHOEkX2aQAxFRgLKqqVWDYGFgx0pwLRPkjImRMYJGoQJnBNiFIdCSIJwgySGE2SwZVwgr1DO48OB8vEXVYb46afFqz4MRkE7oVhQlYyBBE7augDC+DkgUiUZgqnlLqkk-eniOCRwEEcCA3iFgADFBACCCiQXi7C4qcKCq0jA7S0m8O6QIXp-T-EIxqNKFs35VQSlVDKQmpg5aohESqAcnQQT1NUbzZJTSWltI6ZUKZMykJIIHno4eozxk8J8lcvplI5mCwWeYRsEkWzNXbJ2YwfY-D42kKieJHY2zNgab5HWHdHkXPYK8-pGSTTIWyaYxGk5IjPmsHXfQeEoT-1UqLfowpKIdlWUBDWRjGEpOaQiiZLyelvNOKipCdp+E5JqNiowzY8U+FskSkiw5TAmGlCEQioR-j6BiFqDAFBT7wFKIixpkEMUBMQAAWnIdqxsIQQiE3BGClx0QjmGzVaxHgahBC3DEBq+ZiBUQyXCE2YWSjJxgOFtC81NsNHZGpNcOkcKEbw0+Y5OuJg1ZDCUSqQFuNgHfmDN2AOYCnBTl9aw-1nAeKBvNH5ZkbIOQOvDQgA1AQxy2BbKdWwuNmwmDqo4cwjRykwuzWxVc650AludDXMBPRmoGAlP8cwTg5aRs6GGGu+g0RgJUTS45lrkzsX0rBQyRbjLTR7VZex-g0QuU6HXIdE5Sm1GDKLHQSsgkShDMLNtBbsiQ2mo9Wa27lrANdWYP2-QPKdikf-ORAQpZKLBUKds96Q2cCfQ9PqRk31Cxlvjaw7YKIQk9iRYB-hKUFJogU4BEGmGcD1jzC1gsw2Ox7EYYWql5aqS6MUuWdgjAhjrpQ7GSiCP0s7tnbByd4M1GDK6hwlEpRbyBcS-0-LURlTqiEMwnGmlHwwXfLBGBe7KufpigTVFGzlKVJ6cMX65YQnkljaVUo-DdgUzdVVZGHaCNHP4Fy2KP32OCDJBx1gzCIkIuiexzdM3qIfak55loN08X44gX+nYAzlOA-oKio4ZKExMFLFUQJ4mnWs6xM5YzbPIspJFhAXR0QBkOkKLGdUOybIA4YAIwDDCehVCCfDgWoHBYZecplXSWUovC1u+2AjlpgiYyIicl6St4SXvI7oX7RzWCDFhbLxJkCsmIEwWAGm8Fab+LYIwLk66tnCEOsFyXdPyKGO7QIGaF2kfbQAUUGjgIrhgbABl-EdiqtFfT-HxgOd0TsQMdjlVEIAA */
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
            subset: null,
            contexts: [],
            clearSigningType: null,
            transactionType: null,
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
              target: "ParseTransaction",
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
          // This ensures the intermediateValue is captured before moving to ParseTransaction
          after: {
            0: {
              target: "ParseTransaction",
            },
          },
        },
        ParseTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.PARSE_TRANSACTION,
            },
          }),
          invoke: {
            id: "parseTransaction",
            src: "parseTransaction",
            input: ({ context }) => ({
              mapper: context.input.mapper,
              transaction: context.input.transaction,
            }),
            onDone: {
              target: "BuildContexts",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  subset: event.output.subset,
                  transactionType: event.output.type,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        BuildContexts: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXTS,
            },
          }),
          invoke: {
            id: "buildContexts",
            src: "buildContexts",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              mapper: context.input.mapper,
              parser: context.input.parser,
              options: context.input.options,
              appConfig: context._internalState.appConfig!,
              derivationPath: context.input.derivationPath,
              subset: context._internalState.subset!,
              transaction: context.input.transaction,
              deviceModelId: internalApi.getDeviceModel().id,
            }),
            onDone: {
              target: "ProvideContexts",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    contexts: event.output.clearSignContexts,
                    clearSigningType: event.output.clearSigningType,
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
        ProvideContexts: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.PROVIDE_CONTEXTS,
            },
          }),
          exit: assign({
            // remove the first context of the first transaction details as it has been consumed
            _internalState: ({ context }) => {
              return {
                ...context._internalState,
                contexts: context._internalState.contexts.slice(1),
              };
            },
          }),
          invoke: {
            id: "provideContexts",
            src: "provideContexts",
            input: ({ context }) => ({
              contexts: context._internalState.contexts,
              derivationPath: context.input.derivationPath,
              serializedTransaction: context.input.transaction,
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
              serializedTransaction: context.input.transaction,
              chainId: context._internalState.subset!.chainId,
              transactionType: context._internalState.transactionType!,
              clearSigningType: context._internalState.clearSigningType!,
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
              target: "SignTransactionResultCheck",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransactionResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            {
              guard: "notRefusedByUser",
              target: "BlindSignTransactionFallback",
            },
            { target: "Error" },
          ],
        },
        BlindSignTransactionFallback: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BLIND_SIGN_TRANSACTION_FALLBACK,
            },
          }),
          invoke: {
            id: "blindSignTransactionFallback",
            src: "signTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              serializedTransaction: context.input.transaction,
              chainId: context._internalState.subset!.chainId,
              transactionType: context._internalState.transactionType!,
              clearSigningType: ClearSigningType.BASIC,
            }),
            onDone: {
              target: "BlindSignTransactionFallbackResultCheck",
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
        BlindSignTransactionFallbackResultCheck: {
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
    const parseTransaction = async (arg0: {
      input: ParseTransactionTaskArgs;
    }) =>
      Promise.resolve(
        new ParseTransactionTask({
          mapper: arg0.input.mapper,
          transaction: arg0.input.transaction,
        }).run(),
      );
    const buildContexts = async (arg0: { input: BuildFullContextsTaskArgs }) =>
      new BuildFullContextsTask(internalApi, arg0.input).run();

    const provideContexts = async (arg0: {
      input: ProvideTransactionContextsTaskArgs;
    }) => {
      return new ProvideTransactionContextsTask(internalApi, arg0.input).run();
    };

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
        chainId: number;
        transactionType: TransactionType;
        clearSigningType: ClearSigningType;
      };
    }) =>
      new SendSignTransactionTask(internalApi, {
        ...arg0.input,
      }).run();

    return {
      getAppConfig,
      web3CheckOptIn,
      parseTransaction,
      buildContexts,
      provideContexts,
      signTransaction,
    };
  }
}
