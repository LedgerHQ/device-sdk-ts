import {
  type ClearSignContext,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type ProvisionGenericClearSignDAError,
  type ProvisionGenericClearSignDAInput,
  type ProvisionGenericClearSignDAIntermediateValue,
  type ProvisionGenericClearSignDAInternalState,
  type ProvisionGenericClearSignDAOutput,
} from "@api/app-binder/ProvisionGenericClearSignDeviceActionTypes";
import { signTransactionDAStateSteps } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { FinalizeGenericClearSignCommand } from "@internal/app-binder/command/FinalizeGenericClearSignCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  BuildGenericClearSignContextTask,
  type ChallengeBoundRequirements,
  type GenericClearSignContext,
} from "@internal/app-binder/task/BuildGenericClearSignContextTask";
import { ProvideGenericClearSignContextTask } from "@internal/app-binder/task/ProvideGenericClearSignContextTask";

export type MachineDependencies = {
  readonly buildGenericClearSignContext: (arg0: {
    input: { contextModule: ContextModule; transaction: Uint8Array };
  }) => Promise<GenericClearSignContext>;
  readonly provideGenericClearSignContext: (arg0: {
    input: {
      derivationPath: string;
      transaction: Uint8Array;
      contextModule: ContextModule;
      poolContexts: ClearSignContext[];
      instructionInfoContexts: ClearSignContext[];
      challengeBoundRequirements: ChallengeBoundRequirements;
    };
  }) => Promise<void>;
  readonly finalizeGenericClearSign: () => Promise<
    CommandResult<void, SolanaAppErrorCodes>
  >;
};

/**
 * Prepares a transaction for generic clear-signing: `BuildContext` (host-side
 * preparation), `ProvideContext` (descriptor streaming), then `Finalize`
 * (validates the session, no UI). Every step is best-effort: any failure
 * resolves to `"degraded"` so the caller can fall back to the legacy path;
 * success resolves to `"prepared"`. The prompt and terminal sign are performed
 * downstream by `SignGenericClearSignDeviceAction`.
 */
export class ProvisionGenericClearSignDeviceAction extends XStateDeviceAction<
  ProvisionGenericClearSignDAOutput,
  ProvisionGenericClearSignDAInput,
  ProvisionGenericClearSignDAError,
  ProvisionGenericClearSignDAIntermediateValue,
  ProvisionGenericClearSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    ProvisionGenericClearSignDAOutput,
    ProvisionGenericClearSignDAInput,
    ProvisionGenericClearSignDAError,
    ProvisionGenericClearSignDAIntermediateValue,
    ProvisionGenericClearSignDAInternalState
  > {
    type types = StateMachineTypes<
      ProvisionGenericClearSignDAOutput,
      ProvisionGenericClearSignDAInput,
      ProvisionGenericClearSignDAError,
      ProvisionGenericClearSignDAIntermediateValue,
      ProvisionGenericClearSignDAInternalState
    >;

    const {
      buildGenericClearSignContext,
      provideGenericClearSignContext,
      finalizeGenericClearSign,
    } = this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "ProvisionGenericClearSignDeviceAction",
    );

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        buildGenericClearSignContext: fromPromise(buildGenericClearSignContext),
        provideGenericClearSignContext: fromPromise(
          provideGenericClearSignContext,
        ),
        finalizeGenericClearSign: fromPromise(finalizeGenericClearSign),
      },
      guards: {
        // Both read from context — the invoke onDone handlers fold the actor
        // output in (where xstate types `event.output`), so no event cast is
        // needed in the guards.
        // At least one instruction was recognised (CAL coverage), so there is
        // something to clear-sign.
        isContextRecognised: ({ context }) =>
          context._internalState.mode !== null &&
          context._internalState.mode !== "none",
        isPrepared: ({ context }) =>
          context._internalState.outcome === "prepared",
      },
    }).createMachine({
      id: "ProvisionGenericClearSignDeviceAction",
      initial: "BuildContext",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signTransactionDAStateSteps.BUILD_GENERIC_CLEAR_SIGN_CONTEXT,
        },
        _internalState: {
          error: null,
          outcome: null,
          mode: null,
          poolContexts: null,
          instructionInfoContexts: null,
          challengeBoundRequirements: null,
        },
      }),
      states: {
        BuildContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.BUILD_GENERIC_CLEAR_SIGN_CONTEXT,
            }),
          }),
          invoke: {
            id: "buildGenericClearSignContext",
            src: "buildGenericClearSignContext",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              transaction: context.input.transaction,
            }),
            // Fold the task output into the context here (typed), then branch
            // on the context in CheckContextRecognised — no event cast.
            onDone: {
              target: "CheckContextRecognised",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  mode: event.output.mode,
                  poolContexts: event.output.poolContexts,
                  instructionInfoContexts: event.output.instructionInfoContexts,
                  challengeBoundRequirements:
                    event.output.challengeBoundRequirements,
                }),
              }),
            },
            onError: {
              target: "Degraded",
              actions: ({ event }) =>
                logger.info(
                  "[ClearSign] build failed; falling back to legacy",
                  {
                    data: { error: event.error },
                  },
                ),
            },
          },
        },
        CheckContextRecognised: {
          always: [
            { target: "ProvideContext", guard: "isContextRecognised" },
            { target: "Degraded" },
          ],
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.PROVIDE_GENERIC_CLEAR_SIGN_CONTEXT,
            }),
          }),
          invoke: {
            id: "provideGenericClearSignContext",
            src: "provideGenericClearSignContext",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              contextModule: context.input.contextModule,
              poolContexts: context._internalState.poolContexts ?? [],
              instructionInfoContexts:
                context._internalState.instructionInfoContexts ?? [],
              challengeBoundRequirements: context._internalState
                .challengeBoundRequirements ?? {
                tokenAccountStates: [],
                altResolutions: [],
                trustedNames: [],
              },
            }),
            onDone: { target: "Finalize" },
            onError: {
              target: "Degraded",
              actions: ({ event }) =>
                logger.info(
                  "[ClearSign] descriptor streaming failed; falling back to legacy",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        Finalize: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.FINALIZE_GENERIC_CLEAR_SIGN,
            }),
          }),
          invoke: {
            id: "finalizeGenericClearSign",
            src: "finalizeGenericClearSign",
            // On success the session is "prepared" for the downstream prompt +
            // terminal sign; any failure degrades to the legacy path. Classify
            // into the context here (typed), then branch on the context in
            // CheckFinalizeResult — no event cast.
            onDone: {
              target: "CheckFinalizeResult",
              actions: [
                assign({
                  _internalState: ({ event, context }) =>
                    isSuccessCommandResult(event.output)
                      ? {
                          ...context._internalState,
                          outcome: "prepared" as const,
                        }
                      : context._internalState,
                }),
                ({ event }) => {
                  if (!isSuccessCommandResult(event.output)) {
                    logger.info(
                      "[ClearSign] FINALIZE failed; falling back to legacy",
                      { data: { output: event.output } },
                    );
                  }
                },
              ],
            },
            onError: {
              target: "Degraded",
              actions: ({ event }) =>
                logger.info(
                  "[ClearSign] FINALIZE threw; falling back to legacy",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        CheckFinalizeResult: {
          always: [
            // Descriptors validated: ready for the prompt + terminal sign.
            { target: "Prepared", guard: "isPrepared" },
            // Validation failed: degrade to legacy.
            { target: "Degraded" },
          ],
        },
        // `outcome` is already set by the transitions above; the final `output`
        // reads it (defaulting a null outcome to "degraded").
        Prepared: { type: "final" },
        Degraded: { type: "final" },
      },
      output: ({ context }) =>
        Right(context._internalState.outcome ?? "degraded"),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const loggerFactory = this.getLoggerFactory(internalApi);

    const buildGenericClearSignContext = async (arg0: {
      input: { contextModule: ContextModule; transaction: Uint8Array };
    }) =>
      new BuildGenericClearSignContextTask({
        contextModule: arg0.input.contextModule,
        transaction: arg0.input.transaction,
        deviceModelId: internalApi.getDeviceSessionState().deviceModelId,
        loggerFactory,
      }).run();

    const provideGenericClearSignContext = async (arg0: {
      input: {
        derivationPath: string;
        transaction: Uint8Array;
        contextModule: ContextModule;
        poolContexts: ClearSignContext[];
        instructionInfoContexts: ClearSignContext[];
        challengeBoundRequirements: ChallengeBoundRequirements;
      };
    }) =>
      new ProvideGenericClearSignContextTask(internalApi, {
        derivationPath: arg0.input.derivationPath,
        transaction: arg0.input.transaction,
        contextModule: arg0.input.contextModule,
        poolContexts: arg0.input.poolContexts,
        instructionInfoContexts: arg0.input.instructionInfoContexts,
        challengeBoundRequirements: arg0.input.challengeBoundRequirements,
        loggerFactory,
      }).run();

    const finalizeGenericClearSign = async () =>
      internalApi.sendCommand(new FinalizeGenericClearSignCommand());

    return {
      buildGenericClearSignContext,
      provideGenericClearSignContext,
      finalizeGenericClearSign,
    };
  }
}
