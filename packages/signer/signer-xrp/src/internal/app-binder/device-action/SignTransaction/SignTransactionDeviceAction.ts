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
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Curve } from "@api/model/Curve";
import { type Signature } from "@api/model/Signature";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";

export type MachineDependencies = {
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      transaction: Uint8Array;
      curve: Curve;
    };
  }) => Promise<CommandResult<Signature, XrpErrorCodes>>;
};

/**
 * Opens the XRP app (unless skipped), then runs {@link SendSignTransactionTask}.
 *
 * Unlike `CallTaskInAppDeviceAction`, the serialized transaction is not closed
 * over a task. It lives on machine `context.input.transaction` and can be
 * supplied from either source:
 * - factory / constructor args (direct `executeDeviceAction`);
 * - parent invoke `input` when this DA is nested via `makeStateMachine`.
 */
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
        signTransaction: fromPromise(signTransaction),
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
      },
      guards: {
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: ({
            context,
            event,
          }): SignTransactionDAInternalState => {
            const eventError: unknown = (event as { error?: unknown }).error;
            return {
              signature: context._internalState.signature,
              error: new UnknownDAError(
                eventError instanceof Error
                  ? eventError.message
                  : String(eventError),
              ),
            };
          },
        }),
      },
    }).createMachine({
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: SignTransactionDAStep.OPEN_APP,
        },
        _internalState: {
          error: null,
          signature: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "SignTransaction", guard: "skipOpenApp" },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: { appName: APP_NAME },
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.event.snapshot.context.intermediateValue,
                  step: SignTransactionDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              target: "CheckOpenAppDeviceActionResult",
              actions: assign({
                _internalState: (_) =>
                  _.event.output.caseOf<SignTransactionDAInternalState>({
                    Right: () => _.context._internalState,
                    Left: (error) => ({
                      ..._.context._internalState,
                      error,
                    }),
                  }),
              }),
            },
          },
        },
        CheckOpenAppDeviceActionResult: {
          always: [
            { target: "SignTransaction", guard: "noInternalError" },
            "Error",
          ],
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            // Always from context.input (seeded by factory args or invoke input).
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              curve: context.input.curve,
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        signature: event.output.data,
                      }
                    : {
                        ...context._internalState,
                        error: event.output.error,
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
            { target: "Success", guard: "noInternalError" },
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
    const loggerFactory =
      this.input.loggerFactory ?? this.getLoggerFactory(internalApi);

    return {
      signTransaction: ({
        input,
      }: {
        input: {
          derivationPath: string;
          transaction: Uint8Array;
          curve: Curve;
        };
      }) => {
        // context.input.transaction is seeded by factory args or invoke input;
        // reject the factory default / missing bytes before hitting the device.
        if (!input.transaction?.length) {
          return Promise.reject(
            new UnknownDAError(
              "SignTransactionDeviceAction requires a non-empty serialized transaction (factory arg or invoke/context input)",
            ),
          );
        }

        return new SendSignTransactionTask(internalApi, {
          derivationPath: input.derivationPath,
          serializedTransaction: input.transaction,
          curve: input.curve,
          loggerFactory,
        }).run();
      },
    };
  }
}
