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
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type CosmosAppErrorCodes } from "@internal/app-binder/command/utils/CosmosAppErrors";
import { CosmosSignDataTask } from "@internal/app-binder/task/CosmosSignDataTask";

export type MachineDependencies = {
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      // Bech32 HRP/prefix, e.g. "cosmos", "osmo", "noble"
      prefix?: string;
      // Canonical JSON bytes of the transaction
      serializedTransaction: Uint8Array;
    };
  }) => Promise<CommandResult<Signature, CosmosAppErrorCodes>>;
};

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTransactionDAOutput,
    SignTransactionDAInput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue,
    SignTransactionDAInternalState
  > {
    type types = StateMachineTypes<
      SignTransactionDAOutput,
      SignTransactionDAInput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue,
      SignTransactionDAInternalState
    >;

    const { signTransaction } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Cosmos" },
        }).makeStateMachine(internalApi),

        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) =>
          context.input.options?.skipOpenApp || false,
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
      id: "CosmosSignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          signature: null as Signature | null,
        },
      }),
      states: {
        InitialState: {
          always: [
            {
              target: "SignTransaction",
              guard: "skipOpenApp",
            },
            "OpenAppDeviceAction",
          ],
        },

        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: {
              appName: "Cosmos",
            },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                }),
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
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },

        CheckOpenAppDeviceActionResult: {
          always: [
            {
              target: "SignTransaction",
              guard: "noInternalError",
            },
            "Error",
          ],
        },

        SignTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              prefix: context.input.options?.bech32Prefix,
              serializedTransaction: context.input.serializedSignDoc,
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      signature: event.output.data,
                    };
                  }
                  return {
                    ...context._internalState,
                    error: event.output.error,
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

        SignTransactionResultCheck: {
          always: [
            {
              guard: "noInternalError",
              target: "Success",
            },
            {
              target: "Error",
            },
          ],
        },

        Success: {
          type: "final",
        },

        Error: {
          type: "final",
        },
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
    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        prefix?: string;
        serializedTransaction: Uint8Array;
      };
    }) =>
      new CosmosSignDataTask(internalApi, {
        derivationPath: arg0.input.derivationPath,
        prefix: arg0.input.prefix,
        serializedTransaction: arg0.input.serializedTransaction,
      }).run();

    return {
      signTransaction,
    };
  }
}
