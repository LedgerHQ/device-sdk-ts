import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  type StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type ProvisionTransactionCheckDAError,
  type ProvisionTransactionCheckDAInput,
  type ProvisionTransactionCheckDAIntermediateValue,
  type ProvisionTransactionCheckDAInternalState,
  type ProvisionTransactionCheckDAOutput,
} from "@api/app-binder/ProvisionTransactionCheckDeviceActionTypes";
import { signTransactionDAStateSteps } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  TransactionCheckOptInCommand,
  type TransactionCheckOptInCommandResponse,
} from "@internal/app-binder/command/TransactionCheckOptInCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { ProvideTransactionCheckTask } from "@internal/app-binder/task/ProvideTransactionCheckTask";

export type MachineDependencies = {
  readonly transactionCheckOptIn: () => Promise<
    CommandResult<TransactionCheckOptInCommandResponse, SolanaAppErrorCodes>
  >;
  readonly provideTransactionCheck: (arg0: {
    input: {
      derivationPath: string;
      transaction: Uint8Array;
      contextModule: ContextModule;
      isBlockhashRefreshNeeded: boolean;
      serializedForTxCheck?: Uint8Array;
    };
  }) => Promise<void>;
};

export class ProvisionTransactionCheckDeviceAction extends XStateDeviceAction<
  ProvisionTransactionCheckDAOutput,
  ProvisionTransactionCheckDAInput,
  ProvisionTransactionCheckDAError,
  ProvisionTransactionCheckDAIntermediateValue,
  ProvisionTransactionCheckDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    ProvisionTransactionCheckDAOutput,
    ProvisionTransactionCheckDAInput,
    ProvisionTransactionCheckDAError,
    ProvisionTransactionCheckDAIntermediateValue,
    ProvisionTransactionCheckDAInternalState
  > {
    type types = StateMachineTypes<
      ProvisionTransactionCheckDAOutput,
      ProvisionTransactionCheckDAInput,
      ProvisionTransactionCheckDAError,
      ProvisionTransactionCheckDAIntermediateValue,
      ProvisionTransactionCheckDAInternalState
    >;

    const { transactionCheckOptIn, provideTransactionCheck } =
      this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "ProvisionTransactionCheckDeviceAction",
    );

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        transactionCheckOptIn: fromPromise(transactionCheckOptIn),
        provideTransactionCheck: fromPromise(provideTransactionCheck),
      },
      guards: {
        shouldOptIn: ({ context }) =>
          !!context._internalState.appConfig &&
          !context._internalState.appConfig.transactionChecksEnabled &&
          !context._internalState.appConfig.transactionChecksOptIn,
        transactionChecksEnabled: ({ context }) =>
          context._internalState.appConfig?.transactionChecksEnabled === true,
      },
    }).createMachine({
      id: "ProvisionTransactionCheckDeviceAction",
      initial: "OptInGate",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN,
        },
        _internalState: {
          appConfig: input.appConfig ?? null,
        },
      }),
      states: {
        OptInGate: {
          always: [
            { target: "OptIn", guard: "shouldOptIn" },
            { target: "ProvideGate" },
          ],
        },
        OptIn: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
              step: signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN,
            }),
          }),
          invoke: {
            id: "transactionCheckOptIn",
            src: "transactionCheckOptIn",
            onDone: {
              target: "OptInResult",
              actions: [
                ({ event }) => {
                  if (!isSuccessCommandResult(event.output)) {
                    logger.warn(
                      "[TransactionCheck] opt-in command returned error, proceeding without transaction-checks",
                      { data: { error: event.output } },
                    );
                  }
                },
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        appConfig: {
                          ...context._internalState.appConfig!,
                          transactionChecksEnabled: event.output.data.enabled,
                        },
                      };
                    }
                    return context._internalState;
                  },
                }),
              ],
            },
            onError: {
              target: "OptInResult",
              actions: ({ event }) =>
                logger.info(
                  "[TransactionCheck] opt-in threw; proceeding without transaction-checks",
                  {
                    data: {
                      error:
                        event.error instanceof Error
                          ? {
                              name: event.error.name,
                              message: event.error.message,
                              stack: event.error.stack,
                            }
                          : String(event.error),
                    },
                  },
                ),
            },
          },
        },
        OptInResult: {
          entry: assign(({ context }) => ({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN_RESULT,
              result:
                context._internalState.appConfig?.transactionChecksEnabled ??
                false,
            },
          })),
          // Zero-delay transition so the entry assign above is visible to
          // onSnapshot observers before the machine moves on.
          after: {
            0: { target: "ProvideGate" },
          },
        },
        ProvideGate: {
          always: [
            { target: "Provide", guard: "transactionChecksEnabled" },
            { target: "Done" },
          ],
        },
        Provide: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.TRANSACTION_CHECKS_PROVIDE,
            }),
          }),
          invoke: {
            id: "provideTransactionCheck",
            src: "provideTransactionCheck",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              contextModule: context.input.contextModule,
              isBlockhashRefreshNeeded:
                context.input.isBlockhashRefreshNeeded ?? false,
              serializedForTxCheck: context.input.serializedForTxCheck,
            }),
            onDone: { target: "Done" },
            onError: {
              target: "Done",
              actions: ({ event }) =>
                logger.info("[TransactionCheck] provide threw; proceeding", {
                  data: {
                    error:
                      event.error instanceof Error
                        ? {
                            name: event.error.name,
                            message: event.error.message,
                            stack: event.error.stack,
                          }
                        : String(event.error),
                  },
                }),
            },
          },
        },
        Done: { type: "final" },
      },
      output: () => Right(undefined),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const transactionCheckOptIn = async () =>
      internalApi.sendCommand(new TransactionCheckOptInCommand());

    const provideTransactionCheck = async (arg0: {
      input: {
        derivationPath: string;
        transaction: Uint8Array;
        contextModule: ContextModule;
        isBlockhashRefreshNeeded: boolean;
        serializedForTxCheck?: Uint8Array;
      };
    }) =>
      new ProvideTransactionCheckTask(internalApi, {
        derivationPath: arg0.input.derivationPath,
        transactionBytes: arg0.input.transaction,
        contextModule: arg0.input.contextModule,
        isBlockhashRefreshNeeded: arg0.input.isBlockhashRefreshNeeded,
        serializedTransactionForTransactionCheck:
          arg0.input.serializedForTxCheck,
        loggerFactory: this.getLoggerFactory(internalApi),
      }).run();

    return { transactionCheckOptIn, provideTransactionCheck };
  }
}
