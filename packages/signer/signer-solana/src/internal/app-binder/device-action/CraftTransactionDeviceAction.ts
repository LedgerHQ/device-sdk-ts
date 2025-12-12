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
  type CraftTransactionDAError,
  type CraftTransactionDAInput,
  type CraftTransactionDAIntermediateValue,
  type CraftTransactionDAInternalState,
  type CraftTransactionDAOutput,
} from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { type PublicKey } from "@api/model/PublicKey";
import {
  GetPubKeyCommand,
  type GetPubKeyCommandResponse,
} from "@internal/app-binder/command/GetPubKeyCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { TransactionCrafterService } from "@internal/app-binder/services/TransactionCrafterService";

export type MachineDependencies = {
  readonly getPublicKey: (arg0: {
    input: { derivationPath: string; checkOnDevice: boolean };
  }) => Promise<CommandResult<GetPubKeyCommandResponse, SolanaAppErrorCodes>>;
  readonly craftTransaction: (arg0: {
    input: { serialisedTransaction: string; newPayerPublicKey: PublicKey };
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

    const { getPublicKey, craftTransaction } =
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
        craftTransaction: fromPromise(craftTransaction),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwDswCcCGAXMAKjmrNgMa4CWA9mgCJgBulZYAghTWgHQCSalKtgA2AZVx4wAYgDaABgC6iUAAdqsQV2UgAHogCMAdgDM3ABwBOOQDY5V69f1zjAFgBMAGhABPRA-3cLgCsxkZWcnJmxnL6AL6xXqgYOPhE2CTkVLQMzKwcWTz8miLikrL6SkggahoF2noIRqaWNnY2js7uXr4ILhbW3G7ObsYWUfrGZn3xiehYkmkZnNlMLOzLPADyKuhsKio5a-lcUhC0YNyUaIzUANYX1Dtoeyql+ACy5AAWV2Dylap1JpaPVEIYgm5Bq5jMYgoY5C59FZPD5EC5DJCMQ4rP0ggi5G4ZiAkvNUsRSBtDnkNtwAMJfMBkW7bXb7KnrAoAJTgAFdhLhZIptDVgWhQY1QqZodZDPozLZbIZrN1EHjIY4xmM3GYTOMiSSUoRyZkuOzjrQ6QymSznmzVtSubz+eUAdUgXUqg0JhNuNLZfLWkqVQgzAE+hYxvogo5RnDDPq5obFhSCmaaahcAAFHkAI2ELAA0mBvKdzpdrncLjAs7n82Qi95-sL3VpPQYzHZBv1DJYLG5wRDDMHrMZDNx9C5jG5+h39FG3HEEsTEwtjZT7RyuNwM9m84Xi1IsJhqJhuCphHgAGYngC23Gru7rDabVRFHtAXo7Fi7Mt7-aCg7Bki34RqBDiuEq-SEkuBqrukKamhu5o8Dutb7t43KwHyuD0oytyCq6b6th+iBuG4tjmJOspRnOEw2MGeIBD21h9GRwTWPKSoJskcFLKmSHpmANZ7vWxaYdhuFMi6za1MRuikeRciUaOc5BLR0TKqiCAOGOzjWHiiIjH0QTcaSRrwSaKy5JuFqwWSFkbKWGDljc9z3iu+CZheVyiNQF5oNgyaWWgL6ArJIJtgg2rotwSoAfCZhkRE-YMRE3ByEEEbojC8pzi4LimUma78dZyHbh55l8ScR4nmeF64NemB3jAPGed5aC+f5gXFVwoVuuFYqRdFY5xXCkRJQSQ5aa4AQWHFthwvlZihsYhW8QhVlHIJrWVRtaDifykn4X1RERSRCCuBC3B9nKamThGanGAx07XSEUYuA4dhBPla32VVm0Oludm7cFB04Vax0VDJoripdkI3WYd2jBYj3Bi4USvaEbjBBOQwyvES5oNQEBwNowNBeupUbND77yQgAC0mk9Iz6URGz7NsxOv0g5TW0FHwAhCGIEj4DTckNF0Wn6aY2osSO0Rwv2i6zDtFMlXzW42i8aa06dg3nbCAxGa4IywhOFj6Gj6OBCEoRwrCkomTBFVq4hVP80dWt2u7XBg2LZ1004BLpVGQRTP4HaTGjFguDbU6GCjxgyixRjc67AM2ShQmPuh-v64HBmDPpIQ9gSk7LcOzixfKd3Y0qXHO6rPUZ2VqEiQ2YNHXn4pDEYgzhrCITLdYc3DmH5gj8tJfakqyvLk3Dnq4Dtku83+d6z3OOxcXhiGME06OFNPTBLHenGfl+huBCBWN2Z6f0AJ-Pk2vncQ93kV27HcJfixIy909WkIRMRrrCC2zhB5pzXjrLcogeRkFYLAeAr4WwBwaEnEIylZS6iMIlFwz0BiJyRAuZa4IOKQMXm7DWFoACimBjyYHfgbaWmCmihh7NjYMSdITBFCB9GcI4IQE1iEAA */
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
              serialisedTransaction:
                context.context.input.serialisedTransaction,
              newPayerPublicKey: context.context._internalState.publicKey!,
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
                          `Failed to craft transaction`,
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
                new UnknownDAError(
                  `No error or serialised transaction available`,
                ),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getPublicKey = async (arg0: {
      input: {
        derivationPath: string;
        checkOnDevice: boolean;
      };
    }) => internalApi.sendCommand(new GetPubKeyCommand(arg0.input));

    const craftTransaction = async (arg0: {
      input: { serialisedTransaction: string; newPayerPublicKey: PublicKey };
    }): Promise<string> =>
      Promise.resolve(
        new TransactionCrafterService().getCraftedTransaction(
          arg0.input.serialisedTransaction,
          arg0.input.newPayerPublicKey,
        ),
      );

    return {
      getPublicKey,
      craftTransaction,
    };
  }
}
