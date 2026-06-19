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

import {
  type SignBasicClearSignDAError,
  type SignBasicClearSignDAInput,
  type SignBasicClearSignDAIntermediateValue,
  type SignBasicClearSignDAInternalState,
  type SignBasicClearSignDAOutput,
} from "@api/app-binder/SignBasicClearSignDeviceActionTypes";
import { signingOperationsDAStateSteps } from "@api/app-binder/SigningOperationsDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type UserInputType } from "@api/model/TransactionResolutionContext";
import { DelayedSignTransactionCommand } from "@internal/app-binder/command/DelayedSignTransactionCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { SignTransactionPreviewCommand } from "@internal/app-binder/command/SignTransactionPreviewCommand";
import {
  SolanaAppCommandError,
  type SolanaAppErrorCodes,
} from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

import { RefreshBlockhashDeviceAction } from "./RefreshBlockhashDeviceAction";

export type MachineDependencies = {
  readonly previewTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<CommandResult<Maybe<Signature>, SolanaAppErrorCodes>>;
  readonly delayedSignTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<CommandResult<Maybe<Signature>, SolanaAppErrorCodes>>;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<CommandResult<Maybe<Signature>, SolanaAppErrorCodes>>;
  readonly zeroBlockhashFn: (arg0: {
    input: { transaction: Uint8Array };
  }) => Promise<Uint8Array>;
};

const USER_REJECTION_CODE: SolanaAppErrorCodes = "6985";

/** Fold a sign command result into the internal state (signature or error). */
function applySignatureResult(
  internalState: SignBasicClearSignDAInternalState,
  result: CommandResult<Maybe<Signature>, SolanaAppErrorCodes>,
): SignBasicClearSignDAInternalState {
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
 * Terminal sign for the legacy (non-generic) path. With a blockhash source it
 * runs the two-step delayed flow — `ZeroBlockhash` then `PreviewTransaction`
 * (0x08) to arm, a best-effort blockhash refresh (shared
 * `RefreshBlockhashDeviceAction`), then `DelayedSign` (0x09). Without a source
 * (or when arming degrades) it falls back to a one-shot `Sign` (0x06).
 */
export class SignBasicClearSignDeviceAction extends XStateDeviceAction<
  SignBasicClearSignDAOutput,
  SignBasicClearSignDAInput,
  SignBasicClearSignDAError,
  SignBasicClearSignDAIntermediateValue,
  SignBasicClearSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignBasicClearSignDAOutput,
    SignBasicClearSignDAInput,
    SignBasicClearSignDAError,
    SignBasicClearSignDAIntermediateValue,
    SignBasicClearSignDAInternalState
  > {
    type types = StateMachineTypes<
      SignBasicClearSignDAOutput,
      SignBasicClearSignDAInput,
      SignBasicClearSignDAError,
      SignBasicClearSignDAIntermediateValue,
      SignBasicClearSignDAInternalState
    >;

    const {
      previewTransaction,
      delayedSignTransaction,
      signTransaction,
      zeroBlockhashFn,
    } = this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "SignBasicClearSignDeviceAction",
    );

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        previewTransaction: fromPromise(previewTransaction),
        delayedSignTransaction: fromPromise(delayedSignTransaction),
        signTransaction: fromPromise(signTransaction),
        zeroBlockhashFn: fromPromise(zeroBlockhashFn),
        refreshBlockhash: new RefreshBlockhashDeviceAction({
          input: {
            transaction: this.input.transaction,
            rpcUrl: this.input.rpcUrl,
            fetchBlockhash: this.input.fetchBlockhash,
            blockhashService: this.input.blockhashService,
          },
        }).makeStateMachine(internalApi),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        isPreviewFallback: ({ context }) =>
          context._internalState.previewFallback,
        hasBlockhashSource: ({ context }) =>
          !!(context.input.rpcUrl || context.input.fetchBlockhash),
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
      id: "SignBasicClearSignDeviceAction",
      initial: "Entry",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signingOperationsDAStateSteps.ZERO_BLOCKHASH,
        },
        _internalState: {
          error: null,
          signature: null,
          zeroedTransaction: null,
          previewFallback: false,
          transactionToSign: null,
        },
      }),
      states: {
        // - source: preview (0x08) to arm, refresh, then SIGN DELAYED (0x09)
        // - no source: one-shot SIGN (0x06) on the original transaction
        Entry: {
          always: [
            { target: "ZeroBlockhash", guard: "hasBlockhashSource" },
            { target: "Sign" },
          ],
        },
        ZeroBlockhash: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signingOperationsDAStateSteps.ZERO_BLOCKHASH,
            }),
          }),
          invoke: {
            id: "zeroBlockhashFn",
            src: "zeroBlockhashFn",
            input: ({ context }) => ({
              transaction: context.input.transaction,
            }),
            onDone: {
              target: "PreviewTransaction",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  zeroedTransaction: event.output,
                }),
              }),
            },
            // Best-effort: a host-side zeroing failure must not block signing;
            // degrade to a plain one-shot sign of the original transaction.
            onError: {
              target: "Sign",
              actions: ({ event }) =>
                logger.info(
                  "[SigningOps] blockhash zeroing failed, signing original transaction",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        PreviewTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signingOperationsDAStateSteps.PREVIEW_TRANSACTION,
            },
          }),
          invoke: {
            id: "previewTransaction",
            src: "previewTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              serializedTransaction: context._internalState.zeroedTransaction!,
              userInputType: context.input.userInputType,
            }),
            onDone: {
              target: "PreviewResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      previewFallback: false,
                    };
                  }
                  const error = event.output.error;
                  if (
                    error instanceof SolanaAppCommandError &&
                    error.errorCode === USER_REJECTION_CODE
                  ) {
                    return { ...context._internalState, error };
                  }
                  return {
                    ...context._internalState,
                    previewFallback: true,
                  };
                },
                intermediateValue: {
                  requiredUserInteraction: UserInteractionRequired.None,
                  step: signingOperationsDAStateSteps.PREVIEW_TRANSACTION,
                },
              }),
            },
            // Best-effort: a preview throw (vs a user rejection, handled in
            // onDone) must not block signing; degrade to a plain one-shot sign
            // of the original transaction.
            onError: {
              target: "Sign",
              actions: ({ event }) =>
                logger.info(
                  "[SigningOps] preview threw, signing original transaction",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        PreviewResultCheck: {
          always: [
            { guard: "noInternalError", target: "RefreshBlockhash" },
            { target: "Error" },
          ],
        },
        RefreshBlockhash: {
          invoke: {
            id: "refreshBlockhash",
            src: "refreshBlockhash",
            input: ({ context }) => ({
              transaction: context.input.transaction,
              rpcUrl: context.input.rpcUrl,
              fetchBlockhash: context.input.fetchBlockhash,
              blockhashService: context.input.blockhashService,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "PatchResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  // The refresh child never errors; it resolves to the bytes to
                  // sign (patched on success, original otherwise).
                  transactionToSign: event.output.caseOf({
                    Right: (tx) => tx,
                    Left: () => context.input.transaction,
                  }),
                }),
              }),
            },
          },
        },
        PatchResultCheck: {
          always: [
            { target: "FallbackSign", guard: "isPreviewFallback" },
            { target: "DelayedSign" },
          ],
        },
        DelayedSign: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: signingOperationsDAStateSteps.DELAYED_SIGN,
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
        // Primary one-shot sign (no blockhash refresh): the device shows the
        // review and signs in a single pass (0x06).
        Sign: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signingOperationsDAStateSteps.SIGN_TRANSACTION,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              serializedTransaction: context.input.transaction,
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
        // Fallback sign (0x06): the 0x08 preview was unsupported, so we sign the
        // (blockhash-patched) transaction non-delayed.
        FallbackSign: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: signingOperationsDAStateSteps.FALLBACK_TO_NON_DELAYED_SIGN,
            },
          }),
          invoke: {
            id: "fallbackSign",
            src: "signTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              // No patch (fetch failed): sign the original tx.
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
        Error: { type: "final" },
      },
      output: ({ context }) =>
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error or signature available"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const blockhashService =
      this.input.blockhashService ?? new BlockhashService();

    const loggerFactory = this.getLoggerFactory(internalApi);

    const previewTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
        userInputType?: UserInputType;
      };
    }) =>
      new SignDataTask(internalApi, {
        commandFactory: (args) =>
          new SignTransactionPreviewCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
            userInputType: arg0.input.userInputType,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
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
        loggerFactory,
      }).run();

    const zeroBlockhashFn = async (arg0: {
      input: { transaction: Uint8Array };
    }) =>
      Promise.resolve(blockhashService.zeroBlockhash(arg0.input.transaction));

    return {
      previewTransaction,
      delayedSignTransaction,
      signTransaction,
      zeroBlockhashFn,
    };
  }
}
