import {
  type DeviceActionStateMachine,
  type InternalApi,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type RefreshBlockhashDAError,
  type RefreshBlockhashDAInput,
  type RefreshBlockhashDAIntermediateValue,
  type RefreshBlockhashDAInternalState,
  type RefreshBlockhashDAOutput,
} from "@api/app-binder/RefreshBlockhashDeviceActionTypes";
import { signingOperationsDAStateSteps } from "@api/app-binder/SigningOperationsDeviceActionTypes";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";

export type MachineDependencies = {
  readonly fetchBlockhashFn: (arg0: {
    input: {
      rpcUrl?: string;
      fetchBlockhash?: () => Promise<Uint8Array>;
    };
  }) => Promise<Uint8Array>;
  readonly patchBlockhashFn: (arg0: {
    input: { transaction: Uint8Array; freshBlockhash: Uint8Array };
  }) => Promise<Uint8Array>;
};

/**
 * Best-effort blockhash refresh shared by the terminal signing machines:
 * `FetchBlockhash` then `PatchTransaction`. Every step is best-effort — a
 * missing source, a fetch failure, or a patch failure all degrade to the
 * original transaction rather than aborting. The output is always the bytes to
 * sign (patched on success, original otherwise); this child never errors.
 */
export class RefreshBlockhashDeviceAction extends XStateDeviceAction<
  RefreshBlockhashDAOutput,
  RefreshBlockhashDAInput,
  RefreshBlockhashDAError,
  RefreshBlockhashDAIntermediateValue,
  RefreshBlockhashDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    RefreshBlockhashDAOutput,
    RefreshBlockhashDAInput,
    RefreshBlockhashDAError,
    RefreshBlockhashDAIntermediateValue,
    RefreshBlockhashDAInternalState
  > {
    type types = StateMachineTypes<
      RefreshBlockhashDAOutput,
      RefreshBlockhashDAInput,
      RefreshBlockhashDAError,
      RefreshBlockhashDAIntermediateValue,
      RefreshBlockhashDAInternalState
    >;

    const { fetchBlockhashFn, patchBlockhashFn } =
      this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "RefreshBlockhashDeviceAction",
    );

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        fetchBlockhashFn: fromPromise(fetchBlockhashFn),
        patchBlockhashFn: fromPromise(patchBlockhashFn),
      },
      guards: {
        hasBlockhashSource: ({ context }) =>
          !!(context.input.rpcUrl || context.input.fetchBlockhash),
      },
    }).createMachine({
      id: "RefreshBlockhashDeviceAction",
      initial: "Entry",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signingOperationsDAStateSteps.FETCH_BLOCKHASH,
        },
        _internalState: {
          freshBlockhash: null,
          patchedTransaction: null,
        },
      }),
      states: {
        // No source: nothing to refresh, sign the original transaction.
        Entry: {
          always: [
            { target: "FetchBlockhash", guard: "hasBlockhashSource" },
            { target: "Done" },
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
            // Best-effort refresh: a fetch failure signs the original blockhash.
            onError: {
              target: "Done",
              actions: ({ event }) =>
                logger.info(
                  "[RefreshBlockhash] fetch failed, signing original blockhash",
                  { data: { error: event.error } },
                ),
            },
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
              target: "Done",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  patchedTransaction: event.output,
                }),
              }),
            },
            // Best-effort refresh: a patch failure signs the original blockhash.
            onError: {
              target: "Done",
              actions: ({ event }) =>
                logger.info(
                  "[RefreshBlockhash] patch failed, signing original blockhash",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        Done: { type: "final" },
      },
      // Always resolves to the bytes to sign: the patched transaction on a
      // successful refresh, the original transaction otherwise. This child
      // never errors, so the output is always `Right`.
      output: ({ context }) =>
        Right(
          context._internalState.patchedTransaction ??
            context.input.transaction,
        ),
    });
  }

  extractDependencies(_internalApi: InternalApi): MachineDependencies {
    const blockhashService =
      this.input.blockhashService ?? new BlockhashService();

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
      fetchBlockhashFn,
      patchBlockhashFn,
    };
  }
}
