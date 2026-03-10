import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import {
  GetPubKeyCommand,
  type GetPubKeyCommandResponse,
  type SolanaAppErrorCodes,
} from "@ledgerhq/device-signer-kit-solana";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type CraftTransactionDAError,
  type CraftTransactionDAInput,
  type CraftTransactionDAIntermediateValue,
  type CraftTransactionDAInternalState,
  type CraftTransactionDAOutput,
} from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { TransactionCrafterService } from "@internal/services/TransactionCrafterService";

export type MachineDependencies = {
  readonly getPublicKey: (arg0: {
    input: { derivationPath: string; checkOnDevice: boolean };
  }) => Promise<CommandResult<GetPubKeyCommandResponse, SolanaAppErrorCodes>>;
  readonly fetchTransaction: (arg0: {
    input: { transactionSignature: string; rpcUrl?: string };
  }) => Promise<string>;
  readonly craftTransaction: (arg0: {
    input: { publicKey: string; serialisedTransaction: string };
  }) => Promise<string>;
};

export class CraftTransactionDeviceAction extends XStateDeviceAction<
  CraftTransactionDAOutput,
  CraftTransactionDAInput,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue,
  CraftTransactionDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    CraftTransactionDAOutput,
    CraftTransactionDAInput,
    CraftTransactionDAError,
    CraftTransactionDAIntermediateValue,
    CraftTransactionDAInternalState
  > {
    type types = StateMachineTypes<
      CraftTransactionDAOutput,
      CraftTransactionDAInput,
      CraftTransactionDAError,
      CraftTransactionDAIntermediateValue,
      CraftTransactionDAInternalState
    >;

    const { getPublicKey, fetchTransaction, craftTransaction } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Solana" },
        }).makeStateMachine(internalApi),
        getPublicKey: fromPromise(getPublicKey),
        fetchTransaction: fromPromise(fetchTransaction),
        craftTransaction: fromPromise(craftTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => !!context.input.skipOpenApp,
        hasTransactionSignature: ({ context }) =>
          !!context.input.transactionSignature,
        hasSerialisedTransaction: ({ context }) =>
          !!context.input.serialisedTransaction,
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
      id: "CraftTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          publicKey: null,
          fetchedTransaction: null,
          serialisedTransaction: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "FetchTransaction", guard: "hasTransactionSignature" },
            {
              target: "GetPublicKey",
              guard: ({ context }) =>
                !!context.input.serialisedTransaction &&
                !!context.input.skipOpenApp,
            },
            {
              target: "OpenAppDeviceAction",
              guard: "hasSerialisedTransaction",
            },
            {
              target: "Error",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                  error: new UnknownDAError(
                    "Either serialisedTransaction or transactionSignature must be provided",
                  ),
                }),
              }),
            },
          ],
        },
        FetchTransaction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "fetchTransaction",
            src: "fetchTransaction",
            input: (context) => ({
              transactionSignature: context.context.input.transactionSignature!,
              rpcUrl: context.context.input.rpcUrl,
            }),
            onDone: {
              target: "FetchTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output
                    ? {
                        ...context._internalState,
                        fetchedTransaction: event.output,
                      }
                    : {
                        ...context._internalState,
                        error: new UnknownDAError(
                          "Failed to fetch transaction",
                        ),
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        FetchTransactionResultCheck: {
          always: [
            {
              target: "GetPublicKey",
              guard: ({ context }) =>
                context._internalState.error === null &&
                !!context.input.skipOpenApp,
            },
            { target: "OpenAppDeviceAction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        OpenAppDeviceAction: {
          exit: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName: "Solana" }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
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
            { target: "GetPublicKey", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        GetPublicKey: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "getPublicKey",
            src: "getPublicKey",
            input: (context) => ({
              derivationPath: context.context.input.derivationPath,
              checkOnDevice: false,
            }),
            onDone: {
              target: "GetPublicKeyResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        publicKey: event.output.data,
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
        GetPublicKeyResultCheck: {
          always: [
            { target: "CraftTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        CraftTransaction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "craftTransaction",
            src: "craftTransaction",
            input: (context) => ({
              publicKey: context.context._internalState.publicKey!,
              serialisedTransaction:
                context.context._internalState.fetchedTransaction ??
                context.context.input.serialisedTransaction ??
                "",
            }),
            onDone: {
              target: "CraftTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output
                    ? {
                        ...context._internalState,
                        serialisedTransaction: event.output,
                      }
                    : {
                        ...context._internalState,
                        error: new UnknownDAError(
                          "Failed to craft transaction",
                        ),
                      },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        CraftTransactionResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { target: "Error" },
          ],
        },
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) =>
        context._internalState.serialisedTransaction
          ? Right(context._internalState.serialisedTransaction)
          : Left(
              context._internalState.error ||
                new UnknownDAError("No error or transaction available"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getPublicKey = async (arg0: {
      input: { derivationPath: string; checkOnDevice: boolean };
    }) => internalApi.sendCommand(new GetPubKeyCommand(arg0.input));

    const fetchTransaction = async (arg0: {
      input: { transactionSignature: string; rpcUrl?: string };
    }) => {
      return this.input.transactionFetcherService.fetchTransaction(
        arg0.input.transactionSignature,
        arg0.input.rpcUrl,
      );
    };

    const craftTransaction = async (arg0: {
      input: { publicKey: string; serialisedTransaction: string };
    }) => {
      const crafter = new TransactionCrafterService();
      return crafter.getCraftedTransaction(
        arg0.input.serialisedTransaction,
        arg0.input.publicKey,
      );
    };

    return {
      getPublicKey,
      fetchTransaction,
      craftTransaction,
    };
  }
}
