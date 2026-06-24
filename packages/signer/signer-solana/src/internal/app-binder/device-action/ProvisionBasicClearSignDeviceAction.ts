import {
  type DeviceActionStateMachine,
  type InternalApi,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type ProvisionBasicClearSignDAError,
  type ProvisionBasicClearSignDAInput,
  type ProvisionBasicClearSignDAIntermediateValue,
  type ProvisionBasicClearSignDAInternalState,
  type ProvisionBasicClearSignDAOutput,
} from "@api/app-binder/ProvisionBasicClearSignDeviceActionTypes";
import { signTransactionDAStateSteps } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import {
  SolanaTransactionTypes,
  TransactionInspector,
  type TxInspectorResult,
} from "@internal/app-binder/services/TransactionInspector";
import { isSolanaFeatureSupported } from "@internal/app-binder/SolanaApplicationResolver";
import {
  type BasicClearSignContext,
  BuildBasicClearSignContextTask,
  type BuildBasicClearSignContextTaskArgs,
} from "@internal/app-binder/task/BuildBasicClearSignContextTask";
import {
  ProvideBasicClearSignContextTask,
  type ProvideBasicClearSignContextTaskArgs,
} from "@internal/app-binder/task/ProvideBasicClearSignContextTask";

export type MachineDependencies = {
  readonly inspectTransaction: (arg0: {
    serializedTransaction: Uint8Array;
    resolutionContext?: TransactionResolutionContext;
    rpcUrl?: string;
  }) => Promise<TxInspectorResult>;
  readonly buildBasicClearSignContext: (arg0: {
    input: BuildBasicClearSignContextTaskArgs;
  }) => Promise<BasicClearSignContext>;
  readonly provideBasicClearSignContext: (arg0: {
    input: ProvideBasicClearSignContextTaskArgs;
  }) => Promise<void>;
};

/**
 * Streams legacy SPL / token clear-sign descriptors to the device before
 * signing: it inspects the transaction, and — when the app supports SPL or
 * transaction-checks — fetches the public key, builds the descriptor context and
 * provides it. Every step is best-effort: a failure simply ends the machine so
 * the caller falls back to blind signing.
 */
export class ProvisionBasicClearSignDeviceAction extends XStateDeviceAction<
  ProvisionBasicClearSignDAOutput,
  ProvisionBasicClearSignDAInput,
  ProvisionBasicClearSignDAError,
  ProvisionBasicClearSignDAIntermediateValue,
  ProvisionBasicClearSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    ProvisionBasicClearSignDAOutput,
    ProvisionBasicClearSignDAInput,
    ProvisionBasicClearSignDAError,
    ProvisionBasicClearSignDAIntermediateValue,
    ProvisionBasicClearSignDAInternalState
  > {
    type types = StateMachineTypes<
      ProvisionBasicClearSignDAOutput,
      ProvisionBasicClearSignDAInput,
      ProvisionBasicClearSignDAError,
      ProvisionBasicClearSignDAIntermediateValue,
      ProvisionBasicClearSignDAInternalState
    >;

    const {
      inspectTransaction,
      buildBasicClearSignContext,
      provideBasicClearSignContext,
    } = this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "ProvisionBasicClearSignDeviceAction",
    );

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
        buildBasicClearSignContext: fromPromise(buildBasicClearSignContext),
        provideBasicClearSignContext: fromPromise(provideBasicClearSignContext),
      },
      guards: {
        isSPLSupported: ({ context }) =>
          isSolanaFeatureSupported(internalApi, "spl", context.input.appConfig),
        shouldBuildContext: ({ context }) =>
          context._internalState.inspectorResult?.transactionType ===
            SolanaTransactionTypes.SPL ||
          context._internalState.inspectorResult?.transactionType ===
            SolanaTransactionTypes.SWAP,
      },
    }).createMachine({
      id: "ProvisionBasicClearSignDeviceAction",
      initial: "CheckSPLSupported",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signTransactionDAStateSteps.INSPECT_TRANSACTION,
        },
        _internalState: {
          inspectorResult: null,
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
        // Build the descriptor context only when the inspected type needs it
        // (SPL / SWAP); otherwise skip straight to signing.
        CheckBuildNeeded: {
          always: [
            { target: "BuildContext", guard: "shouldBuildContext" },
            { target: "Done" },
          ],
        },
        BuildContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.BUILD_BASIC_CLEAR_SIGN_CONTEXT,
            }),
          }),
          invoke: {
            id: "buildBasicClearSignContext",
            src: "buildBasicClearSignContext",
            input: ({ context }) => {
              const inspectorData =
                context._internalState.inspectorResult?.data;
              return {
                contextModule: context.input.contextModule,
                loggerFactory: this.getLoggerFactory(internalApi),
                transactionBytes: context.input.transaction,
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
              step: signTransactionDAStateSteps.PROVIDE_BASIC_CLEAR_SIGN_CONTEXT,
            }),
          }),
          invoke: {
            id: "provideBasicClearSignContext",
            src: "provideBasicClearSignContext",
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
                logger.error(
                  "[ProvideBasicClearSignContext] Failed to provide transaction context, falling back to blind signing",
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

    const buildBasicClearSignContext = async (arg0: {
      input: BuildBasicClearSignContextTaskArgs;
    }) => new BuildBasicClearSignContextTask(internalApi, arg0.input).run();

    const provideBasicClearSignContext = async (arg0: {
      input: ProvideBasicClearSignContextTaskArgs;
    }) => new ProvideBasicClearSignContextTask(internalApi, arg0.input).run();

    return {
      inspectTransaction,
      buildBasicClearSignContext,
      provideBasicClearSignContext,
    };
  }
}
