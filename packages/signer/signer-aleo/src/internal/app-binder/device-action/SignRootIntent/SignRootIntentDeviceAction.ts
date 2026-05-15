import {
  type AleoTransactionContextResult,
  type ContextModule,
} from "@ledgerhq/context-module";
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
  type SignRootIntentDAError,
  type SignRootIntentDAInput,
  type SignRootIntentDAIntermediateValue,
  type SignRootIntentDAInternalState,
  type SignRootIntentDAOutput,
} from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { type SignRootIntentCommandResponse } from "@internal/app-binder/command/SignRootIntentCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { BuildAleoTokenContextTask } from "@internal/app-binder/task/BuildAleoTokenContextTask";
import { ProvideAleoTokenContextTask } from "@internal/app-binder/task/ProvideAleoTokenContextTask";
import { SignRootIntentTask } from "@internal/app-binder/task/SignRootIntentTask";

type MachineDependencies = {
  readonly buildContext: (arg0: {
    input: {
      tokenInternalId: string;
      programName?: string;
      contextModule: ContextModule;
    };
  }) => Promise<AleoTransactionContextResult>;
  readonly provideContext: (arg0: {
    input: AleoTransactionContextResult;
  }) => Promise<void>;
  readonly signRootIntent: (arg0: {
    input: { derivationPath: string; rootIntent: Uint8Array };
  }) => Promise<CommandResult<SignRootIntentCommandResponse, AleoErrorCodes>>;
};

export class SignRootIntentDeviceAction extends XStateDeviceAction<
  SignRootIntentDAOutput,
  SignRootIntentDAInput,
  SignRootIntentDAError,
  SignRootIntentDAIntermediateValue,
  SignRootIntentDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignRootIntentDAOutput,
    SignRootIntentDAInput,
    SignRootIntentDAError,
    SignRootIntentDAIntermediateValue,
    SignRootIntentDAInternalState
  > {
    type types = StateMachineTypes<
      SignRootIntentDAOutput,
      SignRootIntentDAInput,
      SignRootIntentDAError,
      SignRootIntentDAIntermediateValue,
      SignRootIntentDAInternalState
    >;

    const { buildContext, provideContext, signRootIntent } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signRootIntent: fromPromise(signRootIntent),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        hasTokenContext: ({ context }) =>
          typeof context.input.tokenInternalId === "string" &&
          context.input.tokenInternalId.length > 0 &&
          context.input.contextModule !== undefined,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: ({ context, event }) => ({
            ...context._internalState,
            error: new UnknownDAError(
              event["error"] instanceof Error
                ? event["error"].message
                : String(event["error"]),
            ),
          }),
        }),
      },
    }).createMachine({
      id: "SignRootIntentDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          signature: null,
          aleoTransactionContext: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "CheckTokenContext", guard: "skipOpenApp" },
            { target: "OpenApp" },
          ],
        },
        OpenApp: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "openAppStateMachine",
            src: "openAppStateMachine",
            input: () => ({ appName: APP_NAME }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) => ({
                  ...event.snapshot.context.intermediateValue,
                }),
              }),
            },
            onDone: {
              target: "CheckOpenAppResult",
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
        CheckOpenAppResult: {
          always: [
            { target: "CheckTokenContext", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        CheckTokenContext: {
          always: [
            { target: "BuildContext", guard: "hasTokenContext" },
            { target: "Sign" },
          ],
        },
        BuildContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "buildContext",
            src: "buildContext",
            input: ({ context }) => ({
              tokenInternalId: context.input.tokenInternalId!,
              programName: context.input.programName,
              contextModule: context.input.contextModule!,
            }),
            onDone: {
              target: "ProvideContext",
              actions: assign({
                _internalState: ({ event, context }) => ({
                  ...context._internalState,
                  aleoTransactionContext: event.output,
                }),
              }),
            },
            onError: {
              target: "Sign",
              actions: assign({
                _internalState: ({ context }) => ({
                  ...context._internalState,
                }),
              }),
            },
          },
        },
        ProvideContext: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) => {
              if (!context._internalState.aleoTransactionContext) {
                throw new UnknownDAError(
                  "Aleo transaction context not available",
                );
              }
              return context._internalState.aleoTransactionContext;
            },
            onDone: {
              target: "Sign",
            },
            onError: {
              target: "Sign",
            },
          },
        },
        Sign: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            },
          }),
          invoke: {
            id: "signRootIntent",
            src: "signRootIntent",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              rootIntent: context.input.rootIntent,
            }),
            onDone: {
              target: "SignResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (!isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };
                  }
                  return {
                    ...context._internalState,
                    signature: event.output.data,
                    intermediateValue: {
                      requiredUserInteraction: UserInteractionRequired.None,
                    },
                  };
                },
                intermediateValue: {
                  requiredUserInteraction: UserInteractionRequired.None,
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignResultCheck: {
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
              context._internalState.error ??
                new UnknownDAError("No error or signature available"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const buildContext = async (arg0: {
      input: {
        tokenInternalId: string;
        programName?: string;
        contextModule: ContextModule;
      };
    }): Promise<AleoTransactionContextResult> =>
      new BuildAleoTokenContextTask(internalApi, {
        contextModule: arg0.input.contextModule,
        tokenInternalId: arg0.input.tokenInternalId,
        programName: arg0.input.programName,
      }).run();

    const provideContext = async (arg0: {
      input: AleoTransactionContextResult;
    }): Promise<void> => {
      return new ProvideAleoTokenContextTask(internalApi, {
        aleoTransactionContext: arg0.input,
      }).run();
    };

    const signRootIntent = async (arg0: {
      input: { derivationPath: string; rootIntent: Uint8Array };
    }): Promise<CommandResult<SignRootIntentCommandResponse, AleoErrorCodes>> =>
      new SignRootIntentTask(internalApi, {
        derivationPath: arg0.input.derivationPath,
        rootIntent: arg0.input.rootIntent,
      }).run();

    return { buildContext, provideContext, signRootIntent };
  }
}
