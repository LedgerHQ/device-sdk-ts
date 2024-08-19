import { ContextModule } from "@ledgerhq/context-module";
import {
  InternalApi,
  OpenAppDeviceAction,
  StateMachineTypes,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-sdk-core";
import { Left, Nothing, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  SignTypedDataDAError,
  SignTypedDataDAInput,
  SignTypedDataDAIntermediateValue,
  SignTypedDataDAInternalState,
  SignTypedDataDAOutput,
  SignTypedDataError,
} from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { Signature } from "@api/model/Signature";
import { TypedData } from "@api/model/TypedData";
import { SignEIP712Command } from "@internal/app-binder/command/SignEIP712Command";
import { BuildEIP712ContextTask } from "@internal/app-binder/task/BuildEIP712ContextTask";
import {
  ProvideEIP712ContextTask,
  type ProvideEIP712ContextTaskArgs,
} from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export type MachineDependencies = {
  readonly buildContext: (arg0: {
    input: {
      contextModule: ContextModule;
      parser: TypedDataParserService;
      data: TypedData;
    };
  }) => Promise<ProvideEIP712ContextTaskArgs>;
  readonly provideContext: (arg0: {
    input: {
      taskArgs: ProvideEIP712ContextTaskArgs;
    };
  }) => Promise<void>;
  readonly signTypedData: (arg0: {
    input: {
      derivationPath: string;
    };
  }) => Promise<Signature>;
};

export type ExtractMachineDependencies = (
  internalApi: InternalApi,
) => MachineDependencies;

export class SignTypedDataDeviceAction extends XStateDeviceAction<
  SignTypedDataDAOutput,
  SignTypedDataDAInput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue,
  SignTypedDataDAInternalState
> {
  makeStateMachine(internalApi: InternalApi) {
    type types = StateMachineTypes<
      SignTypedDataDAOutput,
      SignTypedDataDAInput,
      SignTypedDataDAError,
      SignTypedDataDAIntermediateValue,
      SignTypedDataDAInternalState
    >;

    const { buildContext, provideContext, signTypedData } =
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
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signTypedData: fromPromise(signTypedData),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
      },
    }).createMachine({
      id: "SignTypedDataDeviceAction",
      initial: "OpenAppDeviceAction",
      context: ({ input }) => {
        return {
          input,
          intermediateValue: {
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            typedDataContext: null,
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
                  return _.event.output.caseOf<SignTypedDataDAInternalState>({
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
              target: "BuildContext",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        BuildContext: {
          invoke: {
            id: "buildContext",
            src: "buildContext",
            input: ({ context }) => ({
              contextModule: context.input.contextModule,
              parser: context.input.parser,
              data: context.input.data,
            }),
            onDone: {
              target: "ProvideContext",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    typedDataContext: event.output,
                  }),
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  error: new SignTypedDataError(
                    "Error while building the clear signing context",
                  ),
                }),
              }),
            },
          },
        },
        ProvideContext: {
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) => ({
              taskArgs: context._internalState.typedDataContext!,
            }),
            onDone: {
              target: "SignTypedData",
            },
            onError: {
              target: "Error",
              actions: assign({
                _internalState: (_) => ({
                  ..._.context._internalState,
                  error: new SignTypedDataError(
                    "Error while providing the clear signing context",
                  ),
                }),
              }),
            },
          },
        },
        SignTypedData: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
          invoke: {
            id: "signTypedData",
            src: "signTypedData",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
            }),
            onDone: {
              target: "Success",
              actions: [
                // TODO: when we have proper error handling, we should handle the error here
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    signature: event.output,
                  }),
                }),
              ],
            },
            onError: {
              target: "Error",
              actions: [
                assign({
                  _internalState: (_) => ({
                    ..._.context._internalState,
                    error: new SignTypedDataError(
                      "Error while signing the typed data",
                    ),
                  }),
                }),
              ],
            },
          },
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
                new SignTypedDataError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const buildContext = async (arg0: {
      input: {
        contextModule: ContextModule;
        parser: TypedDataParserService;
        data: TypedData;
      };
    }) =>
      new BuildEIP712ContextTask(
        internalApi,
        arg0.input.contextModule,
        arg0.input.parser,
        arg0.input.data,
      ).run();

    const provideContext = async (arg0: {
      input: {
        taskArgs: ProvideEIP712ContextTaskArgs;
      };
    }) => new ProvideEIP712ContextTask(internalApi, arg0.input.taskArgs).run();

    const signTypedData = async (arg0: {
      input: {
        derivationPath: string;
      };
    }) =>
      internalApi.sendCommand(
        new SignEIP712Command({
          derivationPath: arg0.input.derivationPath,
          legacyArgs: Nothing,
        }),
      );

    return {
      buildContext,
      provideContext,
      signTypedData,
    };
  }
}
