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
import { and, assign, fromPromise, setup } from "xstate";

import {
  type SigningOperationsDAError,
  type SigningOperationsDAInput,
  type SigningOperationsDAIntermediateValue,
  type SigningOperationsDAInternalState,
  type SigningOperationsDAOutput,
  signingOperationsDAStateSteps,
} from "@api/app-binder/SigningOperationsDeviceActionTypes";
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

/** Fold a sign command result into the internal state (signature or error). */
function applySignatureResult(
  internalState: SigningOperationsDAInternalState,
  result: CommandResult<Maybe<Signature>, SolanaAppErrorCodes>,
): SigningOperationsDAInternalState {
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

export class SigningOperationsDeviceAction extends XStateDeviceAction<
  SigningOperationsDAOutput,
  SigningOperationsDAInput,
  SigningOperationsDAError,
  SigningOperationsDAIntermediateValue,
  SigningOperationsDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SigningOperationsDAOutput,
    SigningOperationsDAInput,
    SigningOperationsDAError,
    SigningOperationsDAIntermediateValue,
    SigningOperationsDAInternalState
  > {
    type types = StateMachineTypes<
      SigningOperationsDAOutput,
      SigningOperationsDAInput,
      SigningOperationsDAError,
      SigningOperationsDAIntermediateValue,
      SigningOperationsDAInternalState
    >;

    const {
      previewTransaction,
      delayedSignTransaction,
      signTransaction,
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
        signTransaction: fromPromise(signTransaction),
        fetchBlockhashFn: fromPromise(fetchBlockhashFn),
        zeroBlockhashFn: fromPromise(zeroBlockhashFn),
        patchBlockhashFn: fromPromise(patchBlockhashFn),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        isPreviewFallback: ({ context }) =>
          context._internalState.previewFallback,
        isAlreadyArmed: ({ context }) => context.input.alreadyArmed === true,
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2qNQPIAcwAnAQwBdUB7DWAETADdUBjMAQWYuoDoBRDMkQCeAYgDaABgC6iUPkqxUXDLJAAPRAEYArABZuADk0AmbRM0SA7NoDMANgCcDywBoQQxHd03udy85tjc20QuwBfMLc0TGw8QlJlOkYWdk4qDD4BYXFNGSQQeUVlVQ0EHX0jU3MrW0dnNw8EB2MDbhsDFu8nTRNtAwio9CwcAmJydKSmVg5lTMFRMWM8uQUldJKtPUNe6ut7J1d3LWMfEIcDJ2MvTQcb3QGQaOG4scT6KdTZ-nnxG2WC1bFfKlcrbKoWPZ1Q6NCwGfR2DotSzBOx9BwPJ6xUYJCbvFIzdLcABaxEoACEADaUZgAawAFiRYHSRBBqGBuNgGJQaeyAF6kynU+mMukAMQwkn+hTW1A2CEsfm4xl0Tm0zX8Bgk9SOCGVxm4EjVBgMyMsxk0ul0lgxQyx8XG1Em+LSPBJRHJVNpDKZImI7qI3HwFPIADNKEQALbcfnuwVekXiyWqaVA0ClBWWJUqhxq4warXQxBGbjZpwGGwSDoGbR5m0xEb2t7JaYujIABSIyTAAHcACqkGgkVsstkcjBcnmBztMHv9kiD1tJ-Ip9bArT2bTcZqaY12EwtDq6BqIGy6Vo2ByBC8OPxmzR157Yh00PEt2Ydrt9gewIfKX1Ef1A2DMgw0jKdPznBdlCXFYilXNN11RLdzV3fdjWVY9dROEsFW0Lw7HaOFywfO1XlxZtPkJD8Z27AAlOAAFcKTIABhOkwFpcRpGTQF4PULQNS3OFOm0HQaz0TDxO4TR-DqY1y3VEiGzIx1X0onhqNQHt6NgJjWPYzixFyHi4NlNcykE85dBEsTTCPHUNxLWx92Mc4rgtJSXhxVSKIJHhRTAMhmDpONhR9VkMHZTluXZENAuC0LvTFCVuOXXizIQ3UbC2QIjBknQ8rPSSJH1Woz10PCvC1atPKfJsPj8jIAqCkLPTC5k-XDIDQ3DKM4paxKExSqV0pUcyThyloeksAqeiKnVNXPKsdxCCQrVsWrG3IhrW24NtyGCyCf2HCKovHGLAwO1qhSSxNUtgmUxsy1zLW4SxKksGx-Gy8xMK8Hw-GcSsLmVC5rUiR5bWU7yX183b9pao7f3Sf9AKDHqwPwK7BqZO6RtMp7+N1BxXvekxPu+sxNEws8fBzGxNAZisJuIiHMWh58nTfKirp0vS2I4mkuPxx65RsbLNysfwJFPPxDQcP7FXOHMHGBnoL2MTaVNhnb315xjmIFwzjLSgmxYlg1LGl2XkTVTD3rsEsJDsPNrCIvdtC1mGufUjJ6GDIRICeEdIrHCd2QgMAA6DoYkcXe6ATN8yLwRQwpp3RnnDsTCSYcXxHCuZwrd0Lx0TZqGvM5tTGu4f2SEDiBg86gN0ZA3ruEj6PG9j79keoGDE9F5Ob1aZaM4vBV7YIt6CJl24L0qTXy-rSv6udWZg9OsOLsUTA4+ghOVwyomU9H9OjAn7OdQsazfGME5qy1F3bi9qu4Y3oZUa61vQKjXeMH3ukAeR9CalFPmnPKF8s6YXVpubQ1gzBrR0NNe4y9HxbR8rrQkooSAUgpAAIyHDSTeo5oqThDLgghRCnjANGmLEeECehQMngtPCb1NAe0tH0AiBhwhoNIt7auu0cF4MIbSJuAFv7AV-twChojqFDFoUnTK4Cx7MKvo0F2m5mjOBMJWWm71X5r25jwPmhsDJCyUUPTK3gZqW01Izc0zQ1owNdtwEIQQ+hWAqhWPhgwV51W2uvQkZj9KCxyCLVMRNbGaHseYQINwgj2UaDeR2ZpbgtCspeC4EQIYYEoJHeA+R2aryCSYwmIC5QAFoNGIBqUYspvs5jCBMtY6JxgYHizaEaXRMkSol3Bv49B2sfY1zdB6G6IpWlRNKLoEwbRVZqhkucY0FVklFk3BWJwEhDQyxltlBpmDgkaWnFpL885jpRMqeZc4sTLyWEtNZZZN4FY6nvpmFoXg9AVl4SVE4hydbHPbKc7SBswm0mmXxEEapNz5SMPAzU71vCYS+hIaSNwNSohaM7PxkMAkYMBeU7gzUEptSSpC4+IJlZbmdjoS8JcpavMaGYR2st7BYrhNYe8-CObGKaQjQ6vdWwUtAYgUwn03ovLBnoEwNgaYmhnhWUSmpPkPIBaM+G+tdLmMFiKsWHDMzORMBVHcpd1kID8PqVELtLXZQRJadVQjZh1wbk8PVyc8L6g6O9c0hpPr2CnrEk4Ks9lGFuLikpgSjlErdabNpYC1R51RBYLUJVKxMq0GtR23h76HgpuLQZeLhmCPftgyhYjiFDHdSovc+g5kmBJo4F2c0-quTeinLUJdc1rUdaW0xYKjY0mre00w0ldCGktMicdBgc52IvH0ToWizCex5aU6NTTkAMWYKwWARSHozMQBVW4W4yzGjWs4PCriHnuJrOYIIFpjTtF7VgngvBJFEGHbMpZJ6VmahVNYWpCAWVCXEucEqokEQroiEAA */
      id: "SigningOperationsDeviceAction",
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
          freshBlockhash: null,
          patchedTransaction: null,
          previewFallback: false,
        },
      }),
      states: {
        // Routes the four terminal cases:
        // - armed + RPC source → refresh the blockhash, then SIGN DELAYED (0x09)
        // - armed, no source    → SIGN DELAYED (0x09) on the original tx
        // - not armed + source  → preview (0x08) to arm, refresh, then 0x09
        // - not armed, no source → one-shot SIGN (0x06) on the original tx
        Entry: {
          always: [
            {
              target: "FetchBlockhash",
              guard: and(["isAlreadyArmed", "hasBlockhashSource"]),
            },
            { target: "DelayedSign", guard: "isAlreadyArmed" },
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
              step: signingOperationsDAStateSteps.FETCH_BLOCKHASH,
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
            // Best-effort refresh: a fetch failure signs the original blockhash
            // (no patch) rather than aborting.
            onError: { target: "PatchResultCheck" },
          },
        },
        PatchTransaction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signingOperationsDAStateSteps.PATCH_TRANSACTION,
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
              step: signingOperationsDAStateSteps.DELAYED_SIGN,
            },
          }),
          invoke: {
            id: "delayedSignTransaction",
            src: "delayedSignTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              // Armed without a blockhash source: sign the original transaction.
              serializedTransaction:
                context._internalState.patchedTransaction ??
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
                context._internalState.patchedTransaction ??
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
          new DelayedSignTransactionCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
            userInputType: arg0.input.userInputType,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
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
      return blockhashService.fetchLatestBlockhash(arg0.input.rpcUrl);
    };

    const zeroBlockhashFn = async (arg0: {
      input: { transaction: Uint8Array };
    }) =>
      Promise.resolve(blockhashService.zeroBlockhash(arg0.input.transaction));

    const patchBlockhashFn = async (arg0: {
      input: { transaction: Uint8Array; freshBlockhash: Uint8Array };
    }) =>
      Promise.resolve(
        blockhashService.patchBlockhash(
          arg0.input.transaction,
          arg0.input.freshBlockhash,
        ),
      );

    return {
      previewTransaction,
      delayedSignTransaction,
      signTransaction,
      fetchBlockhashFn,
      zeroBlockhashFn,
      patchBlockhashFn,
    };
  }
}
