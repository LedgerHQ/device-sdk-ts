import {
  ApplicationChecker,
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

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
  type SignTransactionDAStateStep,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import {
  type TransactionResolutionContext,
  type UserInputType,
} from "@api/model/TransactionResolutionContext";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import {
  GetPubKeyCommand,
  type GetPubKeyCommandResponse,
} from "@internal/app-binder/command/GetPubKeyCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  Web3CheckOptInCommand,
  type Web3CheckOptInCommandResponse,
} from "@internal/app-binder/command/Web3CheckOptInCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import {
  SolanaTransactionTypes,
  TransactionInspector,
} from "@internal/app-binder/services/TransactionInspector";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";
import { WEB3_CHECKS_EXCLUDED_DEVICE_MODELS } from "@ledgerhq/context-module";

import {
  SOLANA_MIN_DELAYED_SIGNING_VERSION,
  SOLANA_MIN_SPL_VERSION,
  SOLANA_MIN_WEB3_CHECKS_VERSION,
  SolanaApplicationResolver,
} from "@internal/app-binder/SolanaApplicationResolver";
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

import { DelayedSignTransactionDeviceAction } from "./DelayedSignTransactionDeviceAction";

/**
 * Per-sign `transactionOptions.solanaRPCURL` overrides the builder default
 * (`input.solanaRPCURL`) for inspection and delayed signing.
 */
function resolveSolanaRpcUrl(
  input: SignTransactionDAInput,
): string | undefined {
  return input.transactionOptions?.solanaRPCURL ?? input.solanaRPCURL;
}

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<AppConfiguration, SolanaAppErrorCodes>
  >;
  readonly web3CheckOptIn: () => Promise<
    CommandResult<Web3CheckOptInCommandResponse, SolanaAppErrorCodes>
  >;
  readonly getPubKey: (arg0: {
    derivationPath: string;
    checkOnDevice: boolean;
  }) => Promise<CommandResult<GetPubKeyCommandResponse, SolanaAppErrorCodes>>;
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
  }) => Promise<CommandResult<Maybe<Signature>, SolanaAppErrorCodes>>;
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
      web3CheckOptIn,
      getPubKey,
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
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
        getAppConfig: fromPromise(getAppConfig),
        web3CheckOptIn: fromPromise(web3CheckOptIn),
        getPubKey: fromPromise(
          ({
            input,
          }: {
            input: {
              derivationPath: string;
              checkOnDevice: boolean;
            };
          }) =>
            getPubKey({
              derivationPath: input.derivationPath,
              checkOnDevice: input.checkOnDevice,
            }),
        ),
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
        delayedSignStateMachine: new DelayedSignTransactionDeviceAction({
          input: {
            derivationPath: "",
            transaction: new Uint8Array(),
          },
        }).makeStateMachine(internalApi),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) =>
          context.input.transactionOptions?.skipOpenApp || false,
        isSPLSupported: ({ context }) =>
          new ApplicationChecker(
            internalApi.getDeviceSessionState(),
            context._internalState.appConfig!,
            new SolanaApplicationResolver(),
          )
            .excludeDeviceModel(DeviceModelId.NANO_S)
            .withMinVersionInclusive(SOLANA_MIN_SPL_VERSION)
            .check(),
        isDelayedWithConfigAndSupported: ({ context }) =>
          context.input.transactionOptions?.delayed === true &&
          !!(
            resolveSolanaRpcUrl(context.input) ||
            context.input.transactionOptions?.fetchBlockhash
          ) &&
          new ApplicationChecker(
            internalApi.getDeviceSessionState(),
            context._internalState.appConfig!,
            new SolanaApplicationResolver(),
          )
            .withMinVersionInclusive(SOLANA_MIN_DELAYED_SIGNING_VERSION)
            .check(),
        shouldBuildContext: ({ context }) =>
          context._internalState.inspectorResult?.transactionType ===
            SolanaTransactionTypes.SPL ||
          context._internalState.inspectorResult?.transactionType ===
            SolanaTransactionTypes.SWAP,
        isWeb3ChecksSupported: ({ context }) => {
          const checker = new ApplicationChecker(
            internalApi.getDeviceSessionState(),
            context._internalState.appConfig!,
            new SolanaApplicationResolver(),
          ).withMinVersionInclusive(SOLANA_MIN_WEB3_CHECKS_VERSION);
          for (const model of WEB3_CHECKS_EXCLUDED_DEVICE_MODELS) {
            checker.excludeDeviceModel(model);
          }
          return checker.check();
        },
        hasSignature: ({ context }) =>
          context._internalState.signature !== null,
        shouldOptIn: ({ context }) =>
          !(context._internalState.appConfig!.web3ChecksEnabled ?? false) &&
          !(context._internalState.appConfig!.web3ChecksOptIn ?? false),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EAJgCMADg4BWAGw7jAGhABPRHr3SA7Bx0BONwGYALNOPfvUz1jHQBfUOs0TFwCIjYqWgYmVnIqbl5+IRExKT15JBBlVVSMDW0EfSMzC2s7BDdvHQ5pby9ff0DgsIiQKOx8QhISxMYWeM4AeUUwDGZFRRHk8fEIKjAOVAw6CgBrdYpp2fnhUTAAWRIAC02wGXylFTUqMsQnN1MON2lzK1tEN0MJicOicTlMoM8LXe4Ui6H6sSG7EWYxKHAAwpcwMQdlMZnMFvRRil2AAlOAAVwEpCkcg0RSepQK5T0nmMRmkwR+tX+3iMgVM0mc+j0OgM3Vh0QGcWGhKWqIxWJxh3xyOJVDJsEp1MkeTpjxKLwQLLZzU5NT+CAMeg4rTcBneLN8bx8MN6cJig3GqvGHAA4mBSPi0VQAGboFZrDZbXbrGCB+bBjBhqB3PXFdRM+wGUzeVymaq-OqOMWfe0BHyeNxOPSmV19D3SpGylHsP0BoOh8NgHA4Cg4DiKASiEN9gC2HDjHaT6FTBXpBszRuzuZ0+a5Fr0Hk+HjL2YsLNMtZ69aliISzbVnH98cUieTGq1CuxNPuhX1GdA5R0nh0TRapgMJxC3sBwmgMMVwU8QC3l5Yw63dU8vQvH1ryne8KSpJ8dlyV95w-LRdB-P9AkA4CEB8a0qxzYwnE8H5jW8eDJQRJCkhbNIeFgaYyAbM8MAjDB1k2bY9ijLisVIXjxlnB502eRdRS+Dgc2+c0i2kBoODBUUDA0ytqyPCV4U9GU2MvdJxJ4xCSnEbte37QdhzHMTuMk6z2Bkt85MZT9dHtaRlN8dc6kCALvDBbwzA0jTwqApjjMbc8zJ9ZgQzEHBONcl80wZQ0fyCLSKyA7kjRZa1+UFYFQLFeKpNMokUrS7tMoknCcoXXzyNXa1aO8Txio3SFjC0jwfD8AIghCWr3KShrUVS9KWrIKQdFw995M6-KeqKsiBSaSLIUMYwvgaUFppY+q5VbAAhclUAECBEzETRqVWQSoxE9YACM7oep6wBezy8I2gjyKcbMbQMPqBqLBxPA4HxzD0RpaKhQy3WYkym2S1Fbvux6qGe6k7L7Ach1IEccHHH78f+wHaTndafNB-qId5aGyOBAK3GMQ7aM3KD9HOrHZqutIAAVewYCAwDp17I2EmMByl1AZbloGmcNPrRQRr5gpA8EOHA1daOghoDDg48EIu7G5tbSWKGl2XCYB4me1JxyKecxQVbVl36bW7ytZ-IxK1Usi90+dwaLtAWxT0YXEpoZDUQdp25YfTDMWfDWg8XcKeYR47+rIhwgOaVoxo6SbxQxhK+O9VPfedjAicz0gsLaxm886gvhtZLwYfsQVcz15HvzjoWrcxpPG9bE8baoAShOjUTVBnvjc9yxdeZ0XN-AAoejVXIxVx0vSqxrROG5T+frZF-iSYc8nKfHdf6+khnZO3zrd-3kij6gXhkFZGjhwpWhzNfVids0gLwfu3TuW8OqgxjsNNwlRAGeAcAjMUTgOQjwAryKBl12KcDgUnBB2dsI6kDj-FBbw0EYNLqufuuDpCsnATWRiroMAUBlvAAo5Cb443wsDZm5QAC0pgSpSOaIKeRCiFFOGIbbMWnAeBqEECcMQ7V8LlEaCVRwhs3heErCCSErR0ZCOgWojguIjgEhESDMRWtBSfHDiVMsrhRpmNRpYlRotSHoiofYlUt91QYVILokGzJ-zKVIiVBoAV3CmPQX46E08P4kPMqhBMnYoDRPEfYfwRhB6lyhMpH8wIALHQtpbIydVVFBNybefJlDFSFMNDoIUrhDCALAVpGsgpi6XysffWe4T1GEFco05xmsFLGBFJ8Q+5SnC5lMPlap3xBYGACcnJxnAFrNWmRJTpi4sE1kKhzQxIo3CDIFH4Lwoy9lzzSHjP6-sondzoeUHwUMjYinKV4XpDyRkGU8C8yZHA06qxbkTM5m0PC5muRuBwPUfFpIsRkhpM19kwM4DCv2rdXbtOxAi0GB0Pg7RuYeI2EEtkbLFLszJsy8W2Oscglx+c7QfFFICwxe8jAshNqubZTLIUHI4By0kkSsLkvKMYXeJhDGQnhvoY6e9FU82cGMjeNignIHJMQJgsABHf2QeUAUtKoYlxVdIUOEEPC0QuW4CV+KOAAFF3Y4HlYgK1HwbWAL3vDMwkVumRV0ofcI4QgA */
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
          signerAddress: null,
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
            {
              target: "Web3ChecksOptIn",
              guard: and([
                "noInternalError",
                "isWeb3ChecksSupported",
                "shouldOptIn",
              ]),
            },
            { target: "CheckSPLSupported", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        Web3ChecksOptIn: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
              step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN,
            }),
          }),
          invoke: {
            id: "web3CheckOptIn",
            src: "web3CheckOptIn",
            onDone: {
              target: "Web3ChecksOptInResult",
              actions: [
                ({ event }) => {
                  if (!isSuccessCommandResult(event.output)) {
                    const logger = this.getLoggerFactory(internalApi)(
                      "SignTransactionDeviceAction",
                    );
                    logger.warn(
                      "[Web3ChecksOptIn] opt-in command returned error, proceeding without web3checks",
                      { data: { error: event.output } },
                    );
                  }
                },
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
                    }
                    return context._internalState;
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
              step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN_RESULT,
              result:
                context._internalState.appConfig!.web3ChecksEnabled ?? false,
            },
          })),
          // Zero-delay self-transition: ensures the entry assign above is
          // visible to onSnapshot observers before the machine moves on.
          after: {
            0: {
              target: "PostWeb3ChecksOptIn",
            },
          },
        },
        PostWeb3ChecksOptIn: {
          always: [
            { target: "CheckSPLSupported", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        CheckSPLSupported: {
          always: [
            { target: "InspectTransaction", guard: "isSPLSupported" },
            { target: "CheckBuildNeeded" },
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
              rpcUrl: resolveSolanaRpcUrl(context.input),
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
              target: "CheckDelayed",
            },
          },
        },
        AfterInspect: {
          always: [
            { target: "GetPubKey", guard: "shouldBuildContext" },
            { target: "CheckBuildNeeded" },
          ],
        },
        CheckBuildNeeded: {
          always: [
            {
              target: "GetPubKey",
              guard: "isWeb3ChecksSupported",
            },
            { target: "CheckDelayed" },
          ],
        },
        GetPubKey: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.GET_PUB_KEY,
            }),
          }),
          invoke: {
            id: "getPubKey",
            src: "getPubKey",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              checkOnDevice: false,
            }),
            onDone: {
              target: "BuildContext",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      signerAddress: event.output.data,
                    };
                  }
                  return context._internalState;
                },
              }),
            },
            onError: {
              target: "BuildContext",
            },
          },
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
                loggerFactory: this.getLoggerFactory(internalApi),
                transactionBytes: context.input.transaction,
                signerAddress: context._internalState.signerAddress,
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
              target: "CheckDelayed",
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
                loggerFactory: this.getLoggerFactory(internalApi),
              };
            },
            onDone: {
              target: "CheckDelayed",
            },
            onError: {
              target: "CheckDelayed",
            },
          },
        },
        CheckDelayed: {
          always: [
            {
              target: "InvokeDelayedSign",
              guard: "isDelayedWithConfigAndSupported",
            },
            { target: "SignTransaction" },
          ],
        },
        InvokeDelayedSign: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.DELAYED_SIGN,
            }),
          }),
          invoke: {
            id: "delayedSignStateMachine",
            src: "delayedSignStateMachine",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              rpcUrl: resolveSolanaRpcUrl(context.input),
              fetchBlockhash: context.input.transactionOptions?.fetchBlockhash,
              userInputType:
                context.input.transactionOptions?.transactionResolutionContext
                  ?.userInputType,
              blockhashService: context.input.blockhashService,
            }),
            onSnapshot: {
              actions: [
                assign({
                  intermediateValue: ({ event }) =>
                    ({
                      requiredUserInteraction:
                        event.snapshot.context.intermediateValue
                          .requiredUserInteraction,
                      step: event.snapshot.context.intermediateValue
                        .step as SignTransactionDAStateStep,
                    }) as SignTransactionDAIntermediateValue,
                }),
                ({ event }) => {
                  const stateValue =
                    typeof event.snapshot.value === "string"
                      ? event.snapshot.value
                      : JSON.stringify(event.snapshot.value);
                  this.logger?.debug(
                    `[DelayedSign] Child state: ${stateValue}`,
                    {
                      data: {
                        internalState: event.snapshot.context._internalState,
                        intermediateValue:
                          event.snapshot.context.intermediateValue,
                      },
                    },
                  );
                },
              ],
            },
            onDone: {
              target: "CheckDelayedResult",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf({
                    Right: (signature: Uint8Array) => ({
                      ...context._internalState,
                      signature,
                    }),
                    Left: (error) => {
                      if (error instanceof UnknownDAError) {
                        this.logger?.debug(
                          "Delayed signing failed, falling back to legacy signing",
                          {
                            data: {
                              error: error.originalError?.message,
                            },
                          },
                        );
                        return context._internalState;
                      }
                      return {
                        ...context._internalState,
                        error,
                      };
                    },
                  }),
              }),
            },
          },
        },
        CheckDelayedResult: {
          always: [
            { target: "SignTransactionResultCheck", guard: "hasSignature" },
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
                new UnknownDAError(`No error or signature available`),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppConfig = async () =>
      internalApi.sendCommand(new GetAppConfigurationCommand());

    const web3CheckOptIn = async () =>
      internalApi.sendCommand(new Web3CheckOptInCommand());

    const getPubKey = async (arg0: {
      derivationPath: string;
      checkOnDevice: boolean;
    }) =>
      internalApi.sendCommand(
        new GetPubKeyCommand({
          derivationPath: arg0.derivationPath,
          checkOnDevice: arg0.checkOnDevice,
        }),
      );

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
          arg0.resolutionContext?.templateId,
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
      web3CheckOptIn,
      getPubKey,
      buildContext,
      provideContext,
      signTransaction,
      inspectTransaction,
    };
  }
}
