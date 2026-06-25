import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, type Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import { signClearSignDAStateSteps } from "@api/app-binder/SignClearSignDeviceActionTypes";
import {
  type SignGenericClearSignDAError,
  type SignGenericClearSignDAInput,
  type SignGenericClearSignDAIntermediateValue,
  type SignGenericClearSignDAInternalState,
  type SignGenericClearSignDAOutput,
} from "@api/app-binder/SignGenericClearSignDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type UserInputType } from "@api/model/TransactionResolutionContext";
import { DelayedSignTransactionCommand } from "@internal/app-binder/command/DelayedSignTransactionCommand";
import { PromptUiDisplayCommand } from "@internal/app-binder/command/PromptUiDisplayCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { RefreshBlockhashTask } from "@internal/app-binder/task/RefreshBlockhashTask";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

export type MachineDependencies = {
  readonly promptUiDisplay: () => Promise<
    CommandResult<void, SolanaAppErrorCodes>
  >;
  readonly refreshBlockhash: (arg0: {
    input: {
      transaction: Uint8Array;
      rpcUrl?: string;
      fetchBlockhash?: () => Promise<Uint8Array>;
    };
  }) => Promise<Uint8Array>;
  readonly delayedSignTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<CommandResult<Maybe<Signature>, SolanaAppErrorCodes>>;
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

/** Fold a sign command result into the internal state (signature or error). */
function applySignatureResult(
  internalState: SignGenericClearSignDAInternalState,
  result: CommandResult<Maybe<Signature>, SolanaAppErrorCodes>,
): SignGenericClearSignDAInternalState {
  if (!isSuccessCommandResult(result)) {
    return { ...internalState, error: result.error };
  }
  const data = result.data.extract();
  if (result.data.isJust() && data instanceof Uint8Array) {
    return { ...internalState, signature: data };
  }
  return {
    ...internalState,
    error: new UnknownDAError("No signature available"),
  };
}

/**
 * Terminal sign for a session already prepared by
 * `ProvisionGenericClearSignDeviceAction`: `PromptUiDisplay` (on-device review), then a
 * best-effort blockhash refresh (shared `RefreshBlockhashTask`) and
 * `DelayedSign` (0x09). Prompt failures other than a user cancel resolve to
 * `"degraded"` so the caller can fall back to the legacy basic path; a user
 * cancel or a signing failure surfaces as `Left(error)`.
 */
export class SignGenericClearSignDeviceAction extends XStateDeviceAction<
  SignGenericClearSignDAOutput,
  SignGenericClearSignDAInput,
  SignGenericClearSignDAError,
  SignGenericClearSignDAIntermediateValue,
  SignGenericClearSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignGenericClearSignDAOutput,
    SignGenericClearSignDAInput,
    SignGenericClearSignDAError,
    SignGenericClearSignDAIntermediateValue,
    SignGenericClearSignDAInternalState
  > {
    type types = StateMachineTypes<
      SignGenericClearSignDAOutput,
      SignGenericClearSignDAInput,
      SignGenericClearSignDAError,
      SignGenericClearSignDAIntermediateValue,
      SignGenericClearSignDAInternalState
    >;

    const { promptUiDisplay, refreshBlockhash, delayedSignTransaction } =
      this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "SignGenericClearSignDeviceAction",
    );

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        promptUiDisplay: fromPromise(promptUiDisplay),
        refreshBlockhash: fromPromise(refreshBlockhash),
        delayedSignTransaction: fromPromise(delayedSignTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        hasError: ({ context }) => context._internalState.error !== null,
        isDegraded: ({ context }) => context._internalState.degraded,
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
      id: "SignGenericClearSignDeviceAction",
      initial: "PromptUiDisplay",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signClearSignDAStateSteps.PROMPT_UI_DISPLAY,
        },
        _internalState: {
          error: null,
          signature: null,
          degraded: false,
          transactionToSign: null,
        },
      }),
      states: {
        PromptUiDisplay: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signClearSignDAStateSteps.PROMPT_UI_DISPLAY,
            }),
          }),
          invoke: {
            id: "promptUiDisplay",
            src: "promptUiDisplay",
            // Classify the result into the context here (typed), then branch on
            // the context in CheckPromptResult — no event cast. On approval the
            // blockhash refresh + delayed sign follow.
            onDone: {
              target: "CheckPromptResult",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    // Approved.
                    if (isSuccessCommandResult(event.output)) {
                      return context._internalState;
                    }
                    // User canceled: surface, do not fall back to legacy.
                    if (isUserCancelResult(event.output)) {
                      return {
                        ...context._internalState,
                        error: event.output.error,
                      };
                    }
                    // Any other device error: degrade to legacy.
                    return { ...context._internalState, degraded: true };
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
              target: "CheckPromptResult",
              actions: [
                assign({
                  _internalState: ({ context }) => ({
                    ...context._internalState,
                    degraded: true,
                  }),
                }),
                ({ event }) =>
                  logger.info(
                    "[ClearSign] PROMPT UI DISPLAY threw; falling back to legacy",
                    { data: { error: event.error } },
                  ),
              ],
            },
          },
        },
        CheckPromptResult: {
          always: [
            // User cancel: surface.
            { target: "Error", guard: "hasError" },
            // Non-cancel failure: degrade to legacy.
            { target: "Degraded", guard: "isDegraded" },
            // Approved: refresh the blockhash then sign.
            { target: "RefreshBlockhash" },
          ],
        },
        RefreshBlockhash: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signClearSignDAStateSteps.FETCH_BLOCKHASH,
            }),
          }),
          invoke: {
            id: "refreshBlockhash",
            src: "refreshBlockhash",
            input: ({ context }) => ({
              transaction: context.input.transaction,
              rpcUrl: context.input.rpcUrl,
              fetchBlockhash: context.input.fetchBlockhash,
            }),
            // The refresh task is best-effort and never rejects; it resolves to
            // the bytes to sign (patched on success, original otherwise).
            onDone: {
              target: "DelayedSign",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  transactionToSign: event.output,
                }),
              }),
            },
          },
        },
        DelayedSign: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: signClearSignDAStateSteps.DELAYED_SIGN,
            },
          }),
          invoke: {
            id: "delayedSignTransaction",
            src: "delayedSignTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              serializedTransaction:
                context._internalState.transactionToSign ??
                context.input.transaction,
              userInputType: context.input.userInputType,
            }),
            onDone: {
              target: "ResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  applySignatureResult(context._internalState, event.output),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Degraded: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) => {
        if (context._internalState.error)
          return Left(context._internalState.error);
        if (context._internalState.degraded) return Right("degraded" as const);
        if (context._internalState.signature)
          return Right(context._internalState.signature);
        return Left(new UnknownDAError("No error or signature available"));
      },
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const loggerFactory = this.getLoggerFactory(internalApi);

    const promptUiDisplay = async () =>
      internalApi.sendCommand(new PromptUiDisplayCommand());

    const refreshBlockhash = async (arg0: {
      input: {
        transaction: Uint8Array;
        rpcUrl?: string;
        fetchBlockhash?: () => Promise<Uint8Array>;
      };
    }) =>
      new RefreshBlockhashTask({
        transaction: arg0.input.transaction,
        rpcUrl: arg0.input.rpcUrl,
        fetchBlockhash: arg0.input.fetchBlockhash,
        blockhashService: this.input.blockhashService,
        loggerFactory,
      }).run();

    const delayedSignTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
        userInputType?: UserInputType;
      };
    }) =>
      new SignDataTask(internalApi, {
        commandFactory: (args) =>
          new DelayedSignTransactionCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
            userInputType: arg0.input.userInputType,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
        loggerFactory,
      }).run();

    return {
      promptUiDisplay,
      refreshBlockhash,
      delayedSignTransaction,
    };
  }
}
