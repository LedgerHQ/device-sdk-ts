import {
  ClearSignContextSuccess,
  ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandErrorResult,
  CommandResult,
  type DeviceActionStateMachine,
  InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Maybe, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  SignTransactionDAError,
  SignTransactionDAInput,
  SignTransactionDAIntermediateValue,
  SignTransactionDAInternalState,
  SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { Signature } from "@api/model/Signature";
import { Transaction, TransactionType } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import {
  GetChallengeCommand,
  GetChallengeCommandResponse,
} from "@internal/app-binder/command/GetChallengeCommand";
import {
  BuildTransactionContextTask,
  BuildTransactionContextTaskArgs,
  BuildTransactionTaskResult,
} from "@internal/app-binder/task/BuildTransactionContextTask";
import { ProvideTransactionContextTask } from "@internal/app-binder/task/ProvideTransactionContextTask";
import { ProvideTransactionContextTaskErrorCodes } from "@internal/app-binder/task/ProvideTransactionContextTask";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type MachineDependencies = {
  readonly getChallenge: () => Promise<
    CommandResult<GetChallengeCommandResponse, void>
  >;
  readonly buildContext: (arg0: {
    input: {
      contextModule: ContextModule;
      mapper: TransactionMapperService;
      transaction: Transaction;
      options: TransactionOptions;
      challenge: string;
    };
  }) => Promise<BuildTransactionTaskResult>;
  readonly provideContext: (arg0: {
    input: {
      clearSignContexts: ClearSignContextSuccess[];
    };
  }) => Promise<
    Maybe<CommandErrorResult<ProvideTransactionContextTaskErrorCodes>>
  >;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
      chainId: number;
      transactionType: TransactionType;
      isLegacy: boolean;
    };
  }) => Promise<CommandResult<Signature>>;
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

    const { getChallenge, buildContext, provideContext, signTransaction } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: "Ethereum" },
        }).makeStateMachine(internalApi),
        getChallenge: fromPromise(getChallenge),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
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
            clearSignContexts: null,
            serializedTransaction: null,
            chainId: null,
            transactionType: null,
            challenge: null,
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
            input: { appName: "Ethereum" },
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
              target: "GetChallenge",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        GetChallenge: {
          invoke: {
            id: "getChallenge",
            src: "getChallenge",
            onDone: {
              target: "GetChallengeResultCheck",
              actions: [
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        challenge: event.output.data.challenge,
                      };
                    }
                    return {
                      ...context._internalState,
                      error: event.output.error,
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
        GetChallengeResultCheck: {
          always: [
            {
              target: "BuildContext",
              guard: "noInternalError",
            },
            {
              target: "Error",
            },
          ],
        },
        BuildContext: {
          invoke: {
            id: "buildContext",
            src: "buildContext",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              mapper: context.input.mapper,
              transaction: context.input.transaction,
              options: context.input.options,
              challenge: context._internalState.challenge!,
            }),
            onDone: {
              target: "ProvideContext",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    clearSignContexts: event.output.clearSignContexts!,
                    serializedTransaction: event.output.serializedTransaction,
                    chainId: event.output.chainId,
                    transactionType: event.output.transactionType,
                  }),
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideContext: {
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) => ({
              clearSignContexts: context._internalState.clearSignContexts!,
            }),
            onDone: {
              actions: assign({
                _internalState: ({ event, context }) => {
                  return event.output.caseOf({
                    Just: (error) => ({
                      ...context._internalState,
                      error: error.error,
                    }),
                    Nothing: () => context._internalState,
                  });
                },
              }),
              target: "ProvideContextResultCheck",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        ProvideContextResultCheck: {
          always: [
            {
              target: "SignTransaction",
              guard: "noInternalError",
            },
            {
              target: "Error",
            },
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
              serializedTransaction:
                context._internalState.serializedTransaction!,
              chainId: context._internalState.chainId!,
              transactionType: context._internalState.transactionType!,
              isLegacy: true, // TODO: use ETHEREUM app version to determine if legacy
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: [
                assign({
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
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getChallenge = async () =>
      internalApi.sendCommand(new GetChallengeCommand());
    const buildContext = async (arg0: {
      input: BuildTransactionContextTaskArgs;
    }) => new BuildTransactionContextTask(arg0.input).run();

    const provideContext = async (arg0: {
      input: {
        clearSignContexts: ClearSignContextSuccess[];
      };
    }) =>
      new ProvideTransactionContextTask(internalApi, {
        clearSignContexts: arg0.input.clearSignContexts,
      }).run();

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
        chainId: number;
        transactionType: TransactionType;
        isLegacy: boolean;
      };
    }) => new SendSignTransactionTask(internalApi, arg0.input).run();

    return {
      getChallenge,
      buildContext,
      provideContext,
      signTransaction,
    };
  }
}
