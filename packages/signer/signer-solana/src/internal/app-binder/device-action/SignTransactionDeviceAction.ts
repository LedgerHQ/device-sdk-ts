import {
  bufferToHexaString,
  type CommandErrorResult,
  type CommandResult,
  type DeviceActionStateMachine,
  DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, type Maybe, Right } from "purify-ts";
import { and, assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { ApplicationChecker } from "@internal/app-binder/services/ApplicationChecker";
import {
  SolanaTransactionTypes,
  TransactionInspector,
  type TxInspectorResult,
} from "@internal/app-binder/services/TransactionInspector";
import {
  BuildTransactionContextTask,
  type BuildTransactionContextTaskArgs,
  type SolanaBuildContextResult,
} from "@internal/app-binder/task/BuildTransactionContextTask";
import {
  ProvideSolanaTransactionContextTask,
  type SolanaContextForDevice,
} from "@internal/app-binder/task/ProvideTransactionContextTask";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<AppConfiguration, SolanaAppErrorCodes>
  >;
  readonly buildContext: (arg0: {
    input: BuildTransactionContextTaskArgs;
  }) => Promise<SolanaBuildContextResult>;
  readonly provideContext: (arg0: {
    input: SolanaContextForDevice;
  }) => Promise<Maybe<CommandErrorResult<SolanaAppErrorCodes>>>;
  readonly inspectTransaction: (arg0: {
    serializedTransaction: Uint8Array;
  }) => Promise<TxInspectorResult>;
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

    const {
      signTransaction,
      getAppConfig,
      buildContext,
      provideContext,
      inspectTransaction,
    } = this.extractDependencies(internalApi);

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
        getAppConfig: fromPromise(getAppConfig),
        inspectTransaction: fromPromise(
          ({ input }: { input: SignTransactionDAInput }) =>
            inspectTransaction({ serializedTransaction: input.transaction }),
        ),
        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) => context.input.skipOpenApp,
        isSPLSupported: ({ context }) =>
          new ApplicationChecker(
            internalApi.getDeviceSessionState(),
            context._internalState.appConfig!,
          )
            .withMinVersionExclusive("1.4.0")
            .excludeDeviceModel(DeviceModelId.NANO_S)
            .check(),
        isAnSPLTransaction: ({ context }) =>
          context._internalState.inspectorResult?.transactionType ===
          SolanaTransactionTypes.SPL,
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EARgDsAZg4AOAJzSAbBZ2mATAb3SALIYA0IAJ67pO6R1PGTta2AKwGTk7GoQC+0e5omLgERGxUtAxMrORU3Lz8QiJiUjrySCDKqtkYGtoI+kZmltZ2Ds5unoiBIRyGTiHSPj7GIU62sfHo2PiEJFXpjCypnADyimAYzIqK85lL4hBUYByoGHQUANZHFGsbW8KiYACyJAAWJ2AypUoqalQ1iHoQrYOPYnAYQhYXMY9KY9Hp3F4EFFgaEYQZoUE9LZbBZxiAElNkrN2DtFlUOABhF5gYjnVbrTbbegLLLsABKcAArgJSFI5BoKr9qmVajoDGKOOEHMYzKMgViEZ0gRwdCEdDphuLpKYQrq8QSkjMlqTWTkqTS6TdGSalhzYNzeZISgKflV-nVxUYpXoZaY5bYFR0kToOP0BhZAo4ArYgvrJoaUnNmbtyQBxMCkRkUqgAM3Q+0Ox1OFyOMEzW2zGDzUE+Lsq6hFumMNlDpgMFnMhls0l1xkVCACFg4Fj0Ln0gQsPkBccS00TJOTZPYHHT5cUler4jAOBwFBwHEUAlEOb3AFsOGWs7n0LWyoK3Y26s3TK3252DN3e-3u34BgNoToLhOOYqozoSRpJhkS45KuV5VugdoOuatJ8l85Sug2oC1Ni0KSqOdhiuqQEGP2xjtiqapONIMLqrYMp6GBCbEmki6mpwsEVteUCITyyHnMUaH3phWiIDheh4cBtiEYBo4kUGvgtnCFgGNRPiRD4jFzsxNCsUsK4ZnB1Y8aQfFSLYgkYX8j5iRJBHijJYL9uEIawlYI76KYOi2G2mlEsaunkgAQpyqACBAlZiJovIHBgRwnGclwcAARiFYURWAUW3t89ZWVhonIiqMZtqOIQyjoFghKRVGhsBzbefYph+ricT4vGWn+VBbEcMFoXhVQkXRYW8UlslqV9RgA1OhZOXCnlCB0dihXAQ4fRlRV-ZBH4LhWMMwwQg4vkQQunV6T1aX9RlvLbru+6HseZ6jb16WZfyd6WbNInzQVXnLSVa2VUGupGKMAR9J5Ziqk4h3zixJ3kgACruDAQGAz2DbFRYJUcihI6gKNo1l6Eze64SlRwPi6iOEYET2pHNiYISmB2ljgk1OjQ9pNoI7j+MXVFW47nuB5HqQJ44OeOMUMjqN86QhNCbln2k8Y5OqhCejU1JtNBh23RUZCoQ6j2IwhBzHUsnpBrtVUBYY8NiWqLOflVPL73ulRzgglKESSXY-aNXrVhOF5H7Ke27MtVbzvHRb5JR0dVACzdwv3eLHCO+BMMYK7xOPh7The2CPt2H7QZkeJ6IqT20Y2AdkdtdHsOx8u8dZ8Zpk50K7suN0k5tlYqJWHJiK+KEkqMxY9jthGkRjPXTsJzpcMtw3i-t9SKFTXWXd5z3w7atPg-Kf7MLjzqxiTmKZHebELUYBQKPwGUrecwFwkKx9tQALQWP2X-dI1QBQDgEGDNpBZuOQeBqEEPcMQ28HxzVGP2Xw0hgTNmMNID8QQmrNjATHFMy56S3CZMvRWH8SYQkLuCaQ0JlJWFMP2GE4lQb61JoYcEeCm4ELNBvS0DIthc3ZFyHk8DhKigGMCCmylARyiiFVIwLDlKql8KVThS8IHsQMpxeCUBRGK1FP0AuOIISYLMCMSS-swiSg8l5MUQJqJqMETBLR64uLrwtHoz+olUHiRGBGCEdEPz6HhPJf8HAqI-WxP0cEN956Z1fqQzgZ1xoDU8e6UIvhwlhG1KEGhI4nCMNhP4NSbZhhSSks1CYC8s5OM4IjKWeMZYTUumkx84oYzk0nkEfodg1SWFImPJSm0pIB1MI4t+OQX5LFaXNaeACIzsJjJgrEw9EB+gLkMoIkQRhMzGXEpi5tuGcCmVUdxtIZmfVGF5FU0I+nOConI0J+gVRtmcAYFSGp3nGHGYkjgyBOTECYLAJ+2Ud6II7EOMI6o6oqOGMg1BwJWbWA-PKEuPyNEcAAKKCxwBc2o2DIX2RhT2OFgM9AhmoWRQIPZIjAVvtEIAA */
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
        },
        _internalState: {
          error: null,
          signature: null,
          appConfig: null,
          solanaTransactionContext: null,
          inspectorResult: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            { target: "GetAppConfig", guard: "skipOpenApp" },
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
            { target: "GetAppConfig", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        GetAppConfig: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "getAppConfig",
            src: "getAppConfig",
            onDone: {
              target: "GetAppConfigResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  isSuccessCommandResult(event.output)
                    ? {
                        ...context._internalState,
                        appConfig: event.output.data,
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
        GetAppConfigResultCheck: {
          always: [
            {
              target: "InspectTransaction",
              guard: and(["noInternalError", "isSPLSupported"]),
            },
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        InspectTransaction: {
          invoke: {
            id: "inspectTransaction",
            src: "inspectTransaction",
            input: ({ context }) => ({
              ...context.input,
              serializedTransaction: context.input.transaction,
            }),
            onDone: {
              target: "AfterInspect",
              actions: assign({
                _internalState: (ctx) => ({
                  ...ctx.context._internalState,
                  inspectorResult: ctx.event.output,
                }),
              }),
            },
            onError: "Error",
          },
        },
        AfterInspect: {
          always: [
            { target: "BuildContext", guard: "isAnSPLTransaction" },
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
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
            input: ({ context }) => {
              const inspectorData =
                context._internalState.inspectorResult?.data;
              return {
                contextModule: context.input.contextModule,
                options: {
                  tokenAddress: inspectorData?.tokenAddress,
                  createATA: inspectorData?.createATA,
                },
              };
            },
            onDone: {
              target: "ProvideContext",
              actions: [
                assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    solanaTransactionContext: {
                      descriptor: event.output.descriptor,
                      certificate: event.output.calCertificate,
                      tokenAccount: event.output.addressResult.tokenAccount,
                      owner: event.output.addressResult.owner,
                      contract: event.output.addressResult.contract,
                    },
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
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "provideContext",
            src: "provideContext",
            input: ({ context }) =>
              context._internalState.solanaTransactionContext!,
            onDone: {
              target: "SignTransaction",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
            }),
          }),
          exit: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
            }),
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => {
              return {
                derivationPath: context.input.derivationPath,
                serializedTransaction: context.input.transaction,
              };
            },
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) => {
                  if (!isSuccessCommandResult(event.output)) {
                    return {
                      ...context._internalState,
                      error: event.output.error,
                    };
                  }
                  const maybeSig = event.output.data;
                  if (maybeSig.isJust()) {
                    const sig = maybeSig.extract();
                    if (sig instanceof Uint8Array) {
                      return {
                        ...context._internalState,
                        signature: sig as Signature,
                      };
                    }
                  }
                  return {
                    ...context._internalState,
                    error: new UnknownDAError("No Signature available"),
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
              context._internalState.error ||
                new UnknownDAError("No error or signature available"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const getAppConfig = async () =>
      internalApi.sendCommand(new GetAppConfigurationCommand());

    const buildContext = async (arg0: {
      input: BuildTransactionContextTaskArgs;
    }) => new BuildTransactionContextTask(internalApi, arg0.input).run();

    const provideContext = async (arg0: { input: SolanaContextForDevice }) =>
      new ProvideSolanaTransactionContextTask(internalApi, arg0.input).run();

    const inspectTransaction = async (arg0: {
      serializedTransaction: Uint8Array;
    }) =>
      new TransactionInspector(
        bufferToHexaString(arg0.serializedTransaction),
      ).run();

    const signTransaction = async (arg0: {
      input: {
        derivationPath: string;
        serializedTransaction: Uint8Array;
      };
    }) =>
      new SignDataTask(internalApi, {
        commandFactory: (args) =>
          new SignTransactionCommand({
            serializedTransaction: args.chunkedData,
            more: args.more,
            extend: args.extend,
          }),
        derivationPath: arg0.input.derivationPath,
        sendingData: arg0.input.serializedTransaction,
      }).run();

    return {
      getAppConfig,
      buildContext,
      provideContext,
      signTransaction,
      inspectTransaction,
    };
  }
}
