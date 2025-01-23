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
import { Left, type Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

export type MachineDependencies = {
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
    };
  }) => Promise<
    CommandResult<Maybe<Signature | SolanaAppErrorCodes>, SolanaAppErrorCodes>
  >;
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
          input: { appName: "Solana" },
        }).makeStateMachine(internalApi),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"], // NOTE: it should never happen, the error is not typed anymore here
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoB5ABzA2Y8etBk1bkqAYghUwHVBjoUA1nIp8BQ5KTykwAWRIALBWADaABgC6iUDwqxUEjLZAAPRABYAzAHYOAJwAHABMFgCMnhYWUSFBvgA0IACeiEEAbOkcAKxBQQGeASG+3tmeISEAvpVJaJi4BERsVCKMLM2cAMJGYMTKvPyCwvRt4uwASnAArgA2pJKWNkgg9o7Orh4IAQEWHN7RvgGH2dne4UHhSakI+Vnpvtkh4eme2Udh3tW16Nj4hCTOVpiDocbq9foaIZA9rOSawWbzMzhJZ2BxOdgbRDbXb7CyHY6nc6XFJpcIcc6+OLebzxCoBbLhL4gOq-RoA9jQsZUDgAcTApG6eBmM34MGksnkihUchgAqMQpFGBgi1cq3RVExCEi+Q4nnO6RC3ji232QSuiBKZPCEQyZwsmSCNKZLIa-w6nJBfLlCtFYEkYBwOAoOA4PBmugAZsGALYcWWC4W+lXLNXrZabbUBXX6w3GgKm803eLk7ZBTwZF6Uz41Zk-V1NQEjYHODgAISmqBmEE6VD0bnmMgwcgUSlUHAARh2uz2MH3SMnUWsMenEOFtv5HhYghEdt5PPvC7ks2v89EAvdwuFDc6638GxymzD2G2p93e2B+-7A8HQ+HSFGcFjSdOzfWcP3naxVTRNNQAzdccjCbc1wsPcDxJBBfFeDgQneDJHgZAib3qO92RaR8uU4AAFIMGAgMAZzncUh0lUc5B4GjUDohjwIXFZoOXWDEBCU4sl8DJwl8Xxogsc8YkLTwxI4TDlMwjJfHSCwqhrF0SPdciQWoihaPo99PwDIMQzDSMY1DDiuNMiCUT4pcNRXBBhO8UTxMk6TZM8QsNO8PYCkpHwghOIIiNZN1G1EJ9uUM4zuP7OEETBPoFkglN+NcwSEFxHEtziB49wCYlrj3XZhM8e5HQiCJCii+tSJofSW0SziTLAlLpjmdLlAWZEoJclw3IKvYiviU5CnKxBsi3DhHT8fd7hwmk9ya3TYtGEEdLZDomOHKUx0cYj9ucXjUwE9xEFKHDyRCfcHhCF411m9zIiU88jXyQ4-CvTbzofOKKI4PaYvYL8LN-azAI4U7ovvKhLpy0a8ru49HoUx5XrKwtqSzfdSgeeILjKmJAYhsiQd228gaoVK+p6DKUZGzVvHghrNKNEoHn89CT2zHYyjOalPIB7S6ap1qaZbcGkYwRm5XBQanKu3KbvyznIm54o-DKQsscW0I3nSZ4TkKalqhrDAKDo+BlnllqPRg5z1TRzWAFp0kLb2OGkgPA4OSmFZd58Bk0YZZeu9WPc2cpCzLEJdRkix5oI-cQ+dtrn36iOoRzhnetIYb3c1dIy11alHWyTIzfSbJEnQvIgmw14t1KwpMOrb4zulsPuS9BNFRgUvXYzc4goZTzgntE980T3wySNPEJPCfZyg5rO9Oj7l2xA5KS+ytm3OeI5FoqGrMiiEofELSlCaJMpsXCx7t+25tnw6+zuqPxcy7chUNOgRHovHwuUbGh5iwETeHEBkcR7Tv2BjtdqdkupziVv1Me11NjFCwshTSKEGTqX5tceauwojiwkluNcb9JZ91DoXTgTsOjYI1psM4+YEKXniK9N4704itx2CUUI4UGTBC0r3RG2dd7MKlgrTBzNlBsLjrdXmCFHT6kiNsV4htPK6keDVFeW4UKZ3odIneKDnzICmMQJgsAHb-3Hl4J4VUXpFGrjEUohY1xZHCLXE4-j8zkIUkg6mVjuQAFFvw4BUZqco1psLuMNDSLx2RDzAMblePU9I7QvWrNUIAA */
      id: "SignTransactionDeviceAction",
      initial: "OpenAppDeviceAction",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            signature: null,
          },
        };
      },
      states: {
        OpenAppDeviceAction: {
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "openAppStateMachine",
            input: { appName: "Solana" },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) =>
                  _.event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<SignTransactionDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  });
                },
              }),
              target: "CheckOpenAppDeviceActionResult",
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
              serializedTransaction: context.input.transaction,
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (!isSuccessCommandResult(event.output))
                      return {
                        ...context._internalState,
                        error: event.output.error,
                      };

                    const data = event.output.data.extract();
                    if (
                      event.output.data.isJust() &&
                      data instanceof Uint8Array
                    )
                      return {
                        ...context._internalState,
                        signature: data,
                      };

                    return {
                      ...context._internalState,
                      error: new UnknownDAError("No Signature available"),
                    };
                  },
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransactionResultCheck: {
          always: [
            { guard: "noInternalError", target: "Success" },
            { target: "Error" },
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
        serializedTransaction: Uint8Array;
      };
    }) => {
      return new SignDataTask(internalApi, {
        commandFactory: (args) =>
          new SignTransactionCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
      }).run();
    };

    return {
      signTransaction,
    };
  }
}
