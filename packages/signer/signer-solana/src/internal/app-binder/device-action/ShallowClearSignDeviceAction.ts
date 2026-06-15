import {
  type ContextModule,
  type SolanaTransactionContextResultSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type CommandResult,
  type DeviceActionState,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAStateStep,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import {
  GetPubKeyCommand,
  type GetPubKeyCommandResponse,
} from "@internal/app-binder/command/GetPubKeyCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  SolanaTransactionTypes,
  TransactionInspector,
  type TxInspectorResult,
} from "@internal/app-binder/services/TransactionInspector";
import { isSolanaFeatureSupported } from "@internal/app-binder/SolanaApplicationResolver";
import {
  BuildShallowClearSignContextTask,
  type BuildShallowClearSignContextTaskArgs,
  type ShallowClearSignContext,
} from "@internal/app-binder/task/BuildShallowClearSignContextTask";
import {
  ProvideShallowClearSignContextTask,
  type ProvideShallowClearSignContextTaskArgs,
} from "@internal/app-binder/task/ProvideShallowClearSignContextTask";

/**
 * Best-effort outcome: this machine only streams legacy SPL / token descriptors
 * to the device, it never signs. Any failure is swallowed (the caller signs
 * blind), so the output is always `Right`.
 */
export type ShallowClearSignDAOutput = void;

export type ShallowClearSignDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
  readonly appConfig: AppConfiguration;
  readonly rpcUrl?: string;
  readonly resolutionContext?: TransactionResolutionContext;
};

export type ShallowClearSignDAError = SignTransactionDAError;

export type ShallowClearSignDAIntermediateValue = {
  requiredUserInteraction: UserInteractionRequired;
  step: SignTransactionDAStateStep;
};

export type ShallowClearSignDAInternalState = {
  readonly inspectorResult: TxInspectorResult | null;
  readonly signerAddress: string | null;
  readonly solanaTransactionContext: SolanaTransactionContextResultSuccess | null;
};

export type ShallowClearSignDAState = DeviceActionState<
  ShallowClearSignDAOutput,
  ShallowClearSignDAError,
  ShallowClearSignDAIntermediateValue
>;

export type MachineDependencies = {
  readonly inspectTransaction: (arg0: {
    serializedTransaction: Uint8Array;
    resolutionContext?: TransactionResolutionContext;
    rpcUrl?: string;
  }) => Promise<TxInspectorResult>;
  readonly getPubKey: (arg0: {
    input: { derivationPath: string; checkOnDevice: boolean };
  }) => Promise<CommandResult<GetPubKeyCommandResponse, SolanaAppErrorCodes>>;
  readonly buildShallowClearSignContext: (arg0: {
    input: BuildShallowClearSignContextTaskArgs;
  }) => Promise<ShallowClearSignContext>;
  readonly provideShallowClearSignContext: (arg0: {
    input: ProvideShallowClearSignContextTaskArgs;
  }) => Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>>;
};

/**
 * Streams legacy SPL / token clear-sign descriptors to the device before
 * signing: it inspects the transaction, and — when the app supports SPL or
 * web3-checks — fetches the public key, builds the descriptor context and
 * provides it. Every step is best-effort: a failure simply ends the machine so
 * the caller falls back to blind signing.
 */
export class ShallowClearSignDeviceAction extends XStateDeviceAction<
  ShallowClearSignDAOutput,
  ShallowClearSignDAInput,
  ShallowClearSignDAError,
  ShallowClearSignDAIntermediateValue,
  ShallowClearSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    ShallowClearSignDAOutput,
    ShallowClearSignDAInput,
    ShallowClearSignDAError,
    ShallowClearSignDAIntermediateValue,
    ShallowClearSignDAInternalState
  > {
    type types = StateMachineTypes<
      ShallowClearSignDAOutput,
      ShallowClearSignDAInput,
      ShallowClearSignDAError,
      ShallowClearSignDAIntermediateValue,
      ShallowClearSignDAInternalState
    >;

    const {
      inspectTransaction,
      getPubKey,
      buildShallowClearSignContext,
      provideShallowClearSignContext,
    } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
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
        getPubKey: fromPromise(getPubKey),
        buildShallowClearSignContext: fromPromise(buildShallowClearSignContext),
        provideShallowClearSignContext: fromPromise(
          provideShallowClearSignContext,
        ),
      },
      guards: {
        isSPLSupported: ({ context }) =>
          isSolanaFeatureSupported(internalApi, "spl", context.input.appConfig),
        isWeb3ChecksSupported: ({ context }) =>
          isSolanaFeatureSupported(
            internalApi,
            "web3Checks",
            context.input.appConfig,
          ),
        shouldBuildContext: ({ context }) =>
          context._internalState.inspectorResult?.transactionType ===
            SolanaTransactionTypes.SPL ||
          context._internalState.inspectorResult?.transactionType ===
            SolanaTransactionTypes.SWAP,
      },
    }).createMachine({
      id: "ShallowClearSignDeviceAction",
      initial: "CheckSPLSupported",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
        },
        _internalState: {
          inspectorResult: null,
          signerAddress: null,
          solanaTransactionContext: null,
        },
      }),
      states: {
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
              resolutionContext: context.input.resolutionContext,
              rpcUrl: context.input.rpcUrl,
            }),
            onDone: {
              target: "CheckBuildNeeded",
              actions: assign({
                _internalState: ({ context, event }) => ({
                  ...context._internalState,
                  inspectorResult: event.output,
                }),
              }),
            },
            onError: { target: "Done" },
          },
        },
        // Build the descriptor context when the inspected type needs it
        // (SPL / SWAP) or when web3-checks are supported; otherwise skip.
        CheckBuildNeeded: {
          always: [
            { target: "GetPubKey", guard: "shouldBuildContext" },
            { target: "GetPubKey", guard: "isWeb3ChecksSupported" },
            { target: "Done" },
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
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        signerAddress: event.output.data,
                      }
                    : context._internalState,
              }),
            },
            onError: { target: "BuildContext" },
          },
        },
        BuildContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.BUILD_SHALLOW_CLEAR_SIGN_CONTEXT,
            }),
          }),
          invoke: {
            id: "buildShallowClearSignContext",
            src: "buildShallowClearSignContext",
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
                    context.input.resolutionContext?.tokenInternalId,
                  templateId: context.input.resolutionContext?.templateId,
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
                    contextErrorCount: event.output.contextErrorCount,
                  },
                }),
              }),
            },
            onError: { target: "Done" },
          },
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.PROVIDE_SHALLOW_CLEAR_SIGN_CONTEXT,
            }),
          }),
          invoke: {
            id: "provideShallowClearSignContext",
            src: "provideShallowClearSignContext",
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
            onDone: { target: "Done" },
            onError: {
              target: "Done",
              actions: ({ event }) => {
                this.logger?.error(
                  "[ProvideShallowClearSignContext] Failed to provide transaction context, falling back to blind signing",
                  { data: { error: event.error } },
                );
              },
            },
          },
        },
        Done: { type: "final" },
      },
      output: () => Right(undefined),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
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

    const getPubKey = async (arg0: {
      input: { derivationPath: string; checkOnDevice: boolean };
    }) =>
      internalApi.sendCommand(
        new GetPubKeyCommand({
          derivationPath: arg0.input.derivationPath,
          checkOnDevice: arg0.input.checkOnDevice,
        }),
      );

    const buildShallowClearSignContext = async (arg0: {
      input: BuildShallowClearSignContextTaskArgs;
    }) => new BuildShallowClearSignContextTask(internalApi, arg0.input).run();

    const provideShallowClearSignContext = async (arg0: {
      input: ProvideShallowClearSignContextTaskArgs;
    }) => new ProvideShallowClearSignContextTask(internalApi, arg0.input).run();

    return {
      inspectTransaction,
      getPubKey,
      buildShallowClearSignContext,
      provideShallowClearSignContext,
    };
  }
}
