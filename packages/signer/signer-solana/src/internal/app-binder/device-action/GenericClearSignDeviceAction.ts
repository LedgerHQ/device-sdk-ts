import {
  type ClearSignContext,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  type DeviceActionState,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type ClearSignMode,
  type SignTransactionDAError,
  type SignTransactionDAStateStep,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { PromptUiDisplayCommand } from "@internal/app-binder/command/PromptUiDisplayCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  BuildGenericClearSignContextTask,
  type ChallengeBoundRequirements,
  type GenericClearSignContext,
} from "@internal/app-binder/task/BuildGenericClearSignContextTask";
import { ProvideGenericClearSignContextTask } from "@internal/app-binder/task/ProvideGenericClearSignContextTask";

/**
 * Outcome of the generic clear-sign attempt. This machine prepares and arms the
 * device but does not sign — the terminal SIGN MESSAGE DELAYED is run by the
 * caller (shared with the legacy delayed-sign flow).
 * - `Right("armed")` — descriptors streamed and PROMPT UI DISPLAY approved; the
 *   device fingerprint is armed and ready for the terminal sign.
 * - `Right("degraded")` — no instruction recognised or a best-effort step
 *   failed; the caller should fall back to the legacy path.
 * - `Left(error)` — the user cancelled; the caller must surface it.
 */
export type GenericClearSignDAOutput = "armed" | "degraded";

export type GenericClearSignDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
};

export type GenericClearSignDAError = SignTransactionDAError;

export type GenericClearSignDAIntermediateValue = {
  requiredUserInteraction: UserInteractionRequired;
  step: SignTransactionDAStateStep;
};

export type GenericClearSignDAInternalState = {
  readonly error: GenericClearSignDAError | null;
  readonly outcome: GenericClearSignDAOutput | null;
  readonly mode: ClearSignMode | null;
  readonly poolContexts: ClearSignContext[] | null;
  readonly instructionInfoContexts: ClearSignContext[] | null;
  readonly challengeBoundRequirements: ChallengeBoundRequirements | null;
};

export type GenericClearSignDAState = DeviceActionState<
  GenericClearSignDAOutput,
  GenericClearSignDAError,
  GenericClearSignDAIntermediateValue
>;

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
  readonly promptUiDisplay: () => Promise<
    CommandResult<void, SolanaAppErrorCodes>
  >;
};

const USER_REJECTION_CODE: SolanaAppErrorCodes = "6985";

/** A `6985` ("Canceled by user") is a user decision, not a clear-sign error. */
function isUserCancelResult(
  result: CommandResult<void, SolanaAppErrorCodes>,
): boolean {
  return (
    !isSuccessCommandResult(result) &&
    "errorCode" in result.error &&
    result.error.errorCode === USER_REJECTION_CODE
  );
}

/**
 * Prepares a transaction for generic clear-signing and arms the device:
 * `BuildContext` (host-side preparation) then `ProvideContext` (descriptor
 * streaming) then `PromptUiDisplay` (user approval). Every step is best-effort: a
 * failure resolves to `"degraded"` so the caller can fall back to the legacy
 * path; only a user cancel surfaces as `Left(error)`. The terminal SIGN MESSAGE
 * DELAYED is performed by the caller once this resolves to `"armed"`.
 */
export class GenericClearSignDeviceAction extends XStateDeviceAction<
  GenericClearSignDAOutput,
  GenericClearSignDAInput,
  GenericClearSignDAError,
  GenericClearSignDAIntermediateValue,
  GenericClearSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GenericClearSignDAOutput,
    GenericClearSignDAInput,
    GenericClearSignDAError,
    GenericClearSignDAIntermediateValue,
    GenericClearSignDAInternalState
  > {
    type types = StateMachineTypes<
      GenericClearSignDAOutput,
      GenericClearSignDAInput,
      GenericClearSignDAError,
      GenericClearSignDAIntermediateValue,
      GenericClearSignDAInternalState
    >;

    const {
      buildGenericClearSignContext,
      provideGenericClearSignContext,
      promptUiDisplay,
    } = this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "GenericClearSignDeviceAction",
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
        promptUiDisplay: fromPromise(promptUiDisplay),
      },
      guards: {
        // All three read from context — the invoke onDone handlers fold the
        // actor output in (where xstate types `event.output`), so no event
        // cast is needed in the guards.
        // At least one instruction was recognised (CAL coverage), so there is
        // something to clear-sign.
        isContextRecognised: ({ context }) =>
          context._internalState.mode !== null &&
          context._internalState.mode !== "none",
        hasError: ({ context }) => context._internalState.error !== null,
        isArmed: ({ context }) => context._internalState.outcome === "armed",
      },
    }).createMachine({
      id: "GenericClearSignDeviceAction",
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
            onDone: { target: "PromptUiDisplay" },
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
        PromptUiDisplay: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signTransactionDAStateSteps.PROMPT_UI_DISPLAY,
            }),
          }),
          invoke: {
            id: "promptUiDisplay",
            src: "promptUiDisplay",
            // Classify the result into the context here (typed), then branch on
            // the context in CheckPromptResult — no event cast in the guards.
            // The device fingerprint, once approved, is armed over the message
            // with the blockhash zeroed; the caller runs the terminal SIGN
            // MESSAGE DELAYED (no 0x08 preview — that would discard the armed
            // clear-sign session).
            onDone: {
              target: "CheckPromptResult",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    // Approved.
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        outcome: "armed" as const,
                      };
                    }
                    // User canceled: surface, do not re-prompt via legacy.
                    if (isUserCancelResult(event.output)) {
                      return {
                        ...context._internalState,
                        error: event.output.error,
                      };
                    }
                    // Any other device error: degrade (outcome stays null).
                    return context._internalState;
                  },
                }),
                ({ event }) => {
                  if (
                    !isSuccessCommandResult(event.output) &&
                    !isUserCancelResult(event.output)
                  ) {
                    logger.info(
                      "[ClearSign] PROMPT UI DISPLAY failed; falling back to legacy",
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
                  "[ClearSign] PROMPT UI DISPLAY threw; falling back to legacy",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        CheckPromptResult: {
          always: [
            // User cancel: surface.
            { target: "Error", guard: "hasError" },
            // Approved: armed and ready for the terminal sign.
            { target: "Armed", guard: "isArmed" },
            // Any other failure: degrade to legacy.
            { target: "Degraded" },
          ],
        },
        // `outcome`/`error` are already set by the transitions above; the final
        // `output` reads them (defaulting a null outcome to "degraded").
        Armed: { type: "final" },
        Degraded: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) => {
        if (context._internalState.error)
          return Left(context._internalState.error);
        return Right(context._internalState.outcome ?? "degraded");
      },
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

    const promptUiDisplay = async () =>
      internalApi.sendCommand(new PromptUiDisplayCommand());

    return {
      buildGenericClearSignContext,
      provideGenericClearSignContext,
      promptUiDisplay,
    };
  }
}
