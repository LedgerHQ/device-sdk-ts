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
  type GenerateTransactionDAError,
  type GenerateTransactionDAInput,
  type GenerateTransactionDAIntermediateValue,
  type GenerateTransactionDAInternalState,
  type GenerateTransactionDAOutput,
} from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { GenerateSolanaTransaction } from "@internal/services/GenerateSolanaTransaction";

export type MachineDependencies = {
  readonly getPublicKey: (arg0: {
    input: { derivationPath: string; checkOnDevice: boolean };
  }) => Promise<CommandResult<GetPubKeyCommandResponse, SolanaAppErrorCodes>>;
  readonly generateTransaction: (arg0: {
    input: { publicKey: string };
  }) => Promise<string>;
};

export class GenerateTransactionDeviceAction extends XStateDeviceAction<
  GenerateTransactionDAOutput,
  GenerateTransactionDAInput,
  GenerateTransactionDAError,
  GenerateTransactionDAIntermediateValue,
  GenerateTransactionDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GenerateTransactionDAOutput,
    GenerateTransactionDAInput,
    GenerateTransactionDAError,
    GenerateTransactionDAIntermediateValue,
    GenerateTransactionDAInternalState
  > {
    type types = StateMachineTypes<
      GenerateTransactionDAOutput,
      GenerateTransactionDAInput,
      GenerateTransactionDAError,
      GenerateTransactionDAIntermediateValue,
      GenerateTransactionDAInternalState
    >;

    const { getPublicKey, generateTransaction } =
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
        generateTransaction: fromPromise(generateTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
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
      id: "GenerateTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          publicKey: null,
          serialisedTransaction: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "GetPublicKey", guard: "skipOpenApp" },
            { target: "OpenAppDeviceAction" },
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
            { target: "GenerateTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        GenerateTransaction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "generateTransaction",
            src: "generateTransaction",
            input: (context) => ({
              publicKey: context.context._internalState.publicKey!,
            }),
            onDone: {
              target: "GenerateTransactionResultCheck",
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
                          "Failed to generate transaction",
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
        GenerateTransactionResultCheck: {
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

    const generateTransaction = async (arg0: {
      input: { publicKey: string };
    }) => {
      const generator = new GenerateSolanaTransaction();
      const recipientKey = "2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB";
      return generator.generatePlainSolanaTransaction(
        arg0.input.publicKey,
        recipientKey,
        1_000_000,
      );
    };

    return {
      getPublicKey,
      generateTransaction,
    };
  }
}
