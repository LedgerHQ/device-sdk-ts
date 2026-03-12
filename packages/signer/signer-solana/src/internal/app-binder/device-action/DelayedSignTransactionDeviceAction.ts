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
  type DelayedSignDAError,
  type DelayedSignDAInput,
  type DelayedSignDAIntermediateValue,
  type DelayedSignDAInternalState,
  type DelayedSignDAOutput,
  delayedSignDAStateSteps,
} from "@api/app-binder/DelayedSignTransactionDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type UserInputType } from "@api/model/TransactionResolutionContext";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { SignTransactionDelayedCommand } from "@internal/app-binder/command/SignTransactionDelayedCommand";
import { SignTransactionPreviewCommand } from "@internal/app-binder/command/SignTransactionPreviewCommand";
import {
  SolanaAppCommandError,
  type SolanaAppErrorCodes,
} from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  fetchLatestBlockhash,
  patchBlockhash,
  zeroBlockhash,
} from "@internal/app-binder/services/BlockhashService";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

export type MachineDependencies = {
  readonly previewTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<
    CommandResult<Maybe<Signature | SolanaAppErrorCodes>, SolanaAppErrorCodes>
  >;
  readonly delayedSignTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<
    CommandResult<Maybe<Signature | SolanaAppErrorCodes>, SolanaAppErrorCodes>
  >;
  readonly fallbackSignTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      userInputType?: UserInputType;
    };
  }) => Promise<
    CommandResult<Maybe<Signature | SolanaAppErrorCodes>, SolanaAppErrorCodes>
  >;
  readonly fetchBlockhashFn: (arg0: {
    input: {
      rpcUrl?: string;
      fetchBlockhash?: () => Promise<Uint8Array>;
    };
  }) => Promise<Uint8Array>;
  readonly zeroBlockhashFn: (arg0: {
    input: { transaction: Uint8Array };
  }) => Promise<Uint8Array>;
  readonly patchBlockhashFn: (arg0: {
    input: { transaction: Uint8Array; freshBlockhash: Uint8Array };
  }) => Promise<Uint8Array>;
};

const USER_REJECTION_CODE: SolanaAppErrorCodes = "6985";

export class DelayedSignTransactionDeviceAction extends XStateDeviceAction<
  DelayedSignDAOutput,
  DelayedSignDAInput,
  DelayedSignDAError,
  DelayedSignDAIntermediateValue,
  DelayedSignDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    DelayedSignDAOutput,
    DelayedSignDAInput,
    DelayedSignDAError,
    DelayedSignDAIntermediateValue,
    DelayedSignDAInternalState
  > {
    type types = StateMachineTypes<
      DelayedSignDAOutput,
      DelayedSignDAInput,
      DelayedSignDAError,
      DelayedSignDAIntermediateValue,
      DelayedSignDAInternalState
    >;

    const {
      previewTransaction,
      delayedSignTransaction,
      fallbackSignTransaction,
      fetchBlockhashFn,
      zeroBlockhashFn,
      patchBlockhashFn,
    } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        previewTransaction: fromPromise(previewTransaction),
        delayedSignTransaction: fromPromise(delayedSignTransaction),
        fallbackSignTransaction: fromPromise(fallbackSignTransaction),
        fetchBlockhashFn: fromPromise(fetchBlockhashFn),
        zeroBlockhashFn: fromPromise(zeroBlockhashFn),
        patchBlockhashFn: fromPromise(patchBlockhashFn),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        isPreviewFallback: ({ context }) =>
          context._internalState.previewFallback,
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
      id: "DelayedSignTransactionDeviceAction",
      initial: "ZeroBlockhash",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
        },
        _internalState: {
          error: null,
          signature: null,
          zeroedTransaction: null,
          freshBlockhash: null,
          patchedTransaction: null,
          previewFallback: false,
        },
      }),
      states: {
        ZeroBlockhash: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: delayedSignDAStateSteps.ZERO_BLOCKHASH,
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
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        PreviewTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
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
                  step: delayedSignDAStateSteps.PREVIEW_TRANSACTION,
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        PreviewResultCheck: {
          always: [
            { guard: "noInternalError", target: "FetchBlockhash" },
            { target: "Error" },
          ],
        },
        FetchBlockhash: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: delayedSignDAStateSteps.FETCH_BLOCKHASH,
            }),
          }),
          invoke: {
            id: "fetchBlockhashFn",
            src: "fetchBlockhashFn",
            input: ({ context }) => ({
              rpcUrl: context.input.rpcUrl,
              fetchBlockhash: context.input.fetchBlockhash,
            }),
            onDone: {
              target: "PatchTransaction",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  freshBlockhash: event.output,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        PatchTransaction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: delayedSignDAStateSteps.PATCH_TRANSACTION,
            }),
          }),
          invoke: {
            id: "patchBlockhashFn",
            src: "patchBlockhashFn",
            input: ({ context }) => ({
              transaction: context.input.transaction,
              freshBlockhash: context._internalState.freshBlockhash!,
            }),
            onDone: {
              target: "PatchResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  patchedTransaction: event.output,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
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
              step: delayedSignDAStateSteps.DELAYED_SIGN,
            },
          }),
          invoke: {
            id: "delayedSignTransaction",
            src: "delayedSignTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              serializedTransaction: context._internalState.patchedTransaction!,
              userInputType: context.input.userInputType,
            }),
            onDone: {
              target: "ResultCheck",
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
                    error: new UnknownDAError("No signature available"),
                  };
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        FallbackSign: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: delayedSignDAStateSteps.FALLBACK_TO_NON_DELAYED_SIGN,
            },
          }),
          invoke: {
            id: "fallbackSignTransaction",
            src: "fallbackSignTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              serializedTransaction: context._internalState.patchedTransaction!,
              userInputType: context.input.userInputType,
            }),
            onDone: {
              target: "ResultCheck",
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
                    error: new UnknownDAError("No signature available"),
                  };
                },
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
          new SignTransactionDelayedCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
            userInputType: arg0.input.userInputType,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
      }).run();

    const fallbackSignTransaction = async (arg0: {
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

    const fetchBlockhashFn = async (arg0: {
      input: {
        rpcUrl?: string;
        fetchBlockhash?: () => Promise<Uint8Array>;
      };
    }) => {
      if (arg0.input.fetchBlockhash) {
        return arg0.input.fetchBlockhash();
      }
      if (!arg0.input.rpcUrl) {
        throw new Error("No rpcUrl or fetchBlockhash callback provided");
      }
      return fetchLatestBlockhash(arg0.input.rpcUrl);
    };

    const zeroBlockhashFn = async (arg0: {
      input: { transaction: Uint8Array };
    }) => Promise.resolve(zeroBlockhash(arg0.input.transaction));

    const patchBlockhashFn = async (arg0: {
      input: { transaction: Uint8Array; freshBlockhash: Uint8Array };
    }) =>
      Promise.resolve(
        patchBlockhash(arg0.input.transaction, arg0.input.freshBlockhash),
      );

    return {
      previewTransaction,
      delayedSignTransaction,
      fallbackSignTransaction,
      fetchBlockhashFn,
      zeroBlockhashFn,
      patchBlockhashFn,
    };
  }
}
