import {
  type CommandErrorResult,
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
  type SignTransactionDAOutput,
  type SignTransactionDAState,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type CosmosAppErrorCodes } from "@internal/app-binder/command/utils/CosmosAppErrors";
import { ApplicationChecker } from "@internal/app-binder/services/ApplicationChecker";
import {
  BuildTransactionContextTask,
  type BuildTransactionContextTaskArgs,
  type CosmosBuildContextResult,
} from "@internal/app-binder/task/BuildTransactionContextTask";
import {
  ProvideSolanaTransactionContextTask,
  type SolanaContextForDevice,
} from "@internal/app-binder/task/ProvideTransactionContextTask";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

export type MachineDependencies = {
  readonly buildContext: (arg0: {
    input: BuildTransactionContextTaskArgs;
  }) => Promise<SolanaBuildContextResult>;
  readonly provideContext: (arg0: {
    input: SolanaContextForDevice;
  }) => Promise<Maybe<CommandErrorResult<CosmosAppErrorCodes>>>;
  readonly signTransaction: (arg0: {
    input: {
      derivationPath: string;
      serializedTransaction: Uint8Array;
    };
  }) => Promise<
    CommandResult<Maybe<Signature | CosmosAppErrorCodes>, CosmosAppErrorCodes>
  >;
};

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTransactionDAOutput,
    SignTransactionDAInput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue,
    SignTransactionDAState
  > {
    type types = StateMachineTypes<
      SignTransactionDAOutput,
      SignTransactionDAInput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue,
      SignTransactionDAState
    >;

    const { signTransaction, buildContext, provideContext } =
      this.extractDependencies(internalApi);

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

        buildContext: fromPromise(buildContext),
        provideContext: fromPromise(provideContext),
        signTransaction: fromPromise(signTransaction),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) =>
          context.input.transactionOptions?.skipOpenApp || false,
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EARgDsAZg4AOAJzSAbNNOmATNZ0AWPRYA0IAJ67bLjgcfW-hYArNIGpsGOAL5R7miYuAREbFS0DEys5FTcvPxCImJSOvJIIMqqWRga2gj6RmaW1nYOzm6eujqdHNbWPsE6DXq2MXHo2PiEJJVpjCwpnADyimAYzIqKMxnz4hBUYByoGHQUANb7FMur68KiYACyJAAWh2AyJUoqalTViHrBthxbP5-I5HMZjH9gm0vLVpBCOBYnI5bBY9NI4RZjCMQPFxkkpuxNnNKhwAMKPMDEE5LFZrDb0WaZdgAJTgAFcBKQpHINOUvlVSjUdAZhX5HAY9JLbMEDAZMXp3DDOvoOKEXIZgsZ9JrorEcWNEpN5kSmdlyZTqZc6Sb5qzYByuZJirzPpUfrURUZgZKhjK5RDFYgtRxHDZTKCJZjEXosXrcYbktMGVsSQBxMCkOmkqgAM3QOz2ByOp32MEz62zGDzUDeLoq6kFui1plVpgMEIs9kldlsgdq0oBYU6xmkAwh0mCwWx8YmicJyeJ7A46fLikr1fEYBwOAoOA4igEohzu4Athwy1nc+ha6U+W7G7Vm632y4u3oe32dDYOGHzDLLMYEootOBqzgSqQLqanArpeVboHaDrmlS3LvGUroNqANS2D4eh+H8fSvl+eiOJ+tjBnYyKohY5hAtIuqjAkYHGpB8zLhmsHVghnJIScRSoXeGFaIg2GSnh-x-IRpjEX2-g6D+LigqioIyo4kQgYx+LMeki7ZDwsDLGQCbgRgBYYPshzHGcRb6ZSpBGfMN4fPW3wPmRqk-tR6KOE4Oids4pFDAiUmYjYI5gu26l4kaSbaVBOQ2YZTGVJu267vuh6kMeOBnocCV2Ul7COWhzkCphwnGO5pieXRPl+Qq7QII4Vghgp0jqqpOiRfZMWMqxzA5mIOB6QZjo8re6EuWVCAGCJ3SdtRAwxqOvYNZ0IohiEETBKYgHBHowpdQVEGxX1A1bsNtl8XW-LujNPhzSipiLSOOgrUqBgThw752GidHvpqBiHZpPUpku-WDRdZBSLY-ETaVQnTbNliPc9y19lYAKqbY4ZPa9XbDHGoHA-OJ0kgAQmyqACBAlZiJoXK7GZRaWfsABGlPU7TYD00VAmTQjEr9CYr3il+6JOJ+r0WKqQzmDNvk6P8sYMVFc7Hb15MczTVB01yW47nuB5HqeHDs1T2sYLrvNw7dfxyVqtii+Yo4kQ1QzSD+-w7VJIrGCEgOExp0UkxrS4AAo7gwEBgFz9OmeZxZWYokeoNHsekNbJXusibZfQMARO09b0dKiJjGCi6JkdtthOEDwfq6D2QRxQUcxzr3N66lhsZVlZ7Jy3qdt5bHeZzdD450Y+0VXRIo2K9fZ+wCdgRCKvkRPNddqzQLEks3rfp1xpA8Sh133lNrQe-K7ZURjiuS383Shk1fqK8Bgeq8ZNq7ynaft-Th-HydLDLO48XCXwhNfFwt9gifi8j+CcNhsbaklJ1d+3UQ6N04DOYmVB47MxLBwVQQct6jzPgjJWLYIT-DottbyOhSLBjBBERWmp5rGCnGgo629SZLmwfXEy+s0pG0yibIhH8HJjScmPKaFCTD4RoeGToksgQhgQTKCqkJHab0-jvXhRN+EAIpMhUhgkah7URICUIbVpA13FE9T8q8-DlxCJ2Jwjt2HaK0qHbIfCt6GItFdcaICZEuDktKdEaJbHhHoatFEwQnHSmIlJUMM1dR6gwBQaO8BSi+J0Tw-mfN4Y1AALTQkQMU+Jv4qm-gsKpTxIMdKcB4GoQQNwxCn1MYgZEpFMQcH0FjbCgECYq3QQ3RpHAaRXHpPk+GhTbpQkBMCZEnRtpDBCLAiwXoAhVR0BEtqeh6kYPGTxSZ1pdFUEPh0-mQpK7dEVhYaiGiXoGEltYMU1hPJi1WYcsZcUYIVivFAK5RTdChEcICEI5cwT7VUpqUiAwETEXbE0CE4JUEjK4V-Jc-y1yAv8VSYF7p7D3UiGicUyyXA7QCpPcxyItRDCcAczhODuHeKaYQEaozZk21ck1YwgIpK+QCOiJ6VVSILKUtjOe21NkBwxSyrF2RwbnQ5bZQlD4PqBWRoYNqwoXmxPDCGR2q8dq7WVvqYheS2UcApubdO6qpr+FCH0gItT7A2CsJEWBuca6aietQ7y-wfmsswRwPeg97VBOkQLCILYXBKzCJOF8ksujfW8nYKwU96IWvEQ0uK4bf7D3-uybiRiTgOoRqpUciLFb7T9GYSWDyy4oi1G1J6dTmX8MVVg-RW8K01FDELKwP0rHOFBKRD6X0bBNQeaEWeFhg3do4Lk20Jaj5lv7YgSIUkTBkQnB9FJe0HFhEBIrLU4IDCRBFou85WC2TECYLAbJUiyFmMQX0oYOEa751du9OECTMQyn+AEDh8qu23o4AAUS7puhA207AfpEgyn9fZDAtllH7awSaJTghiDEIAA */
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
          solanaTransactionContext: null, // TODO
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
            input: () => ({ appName: "Cosmos" }),
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
            input: ({ context }) => {
              if (!context._internalState.solanaTransactionContext) {
                throw new UnknownDAError(
                  "Solana transaction context is not available",
                );
              }
              return context._internalState.solanaTransactionContext;
            },
            onDone: {
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
            { target: "SignTransaction", guard: "noInternalError" },
            { target: "Error" },
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
            input: ({ context }) => {
              return {
                derivationPath: context.input.derivationPath,
                serializedTransaction: context.input.transaction,
              };
            },
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
        Success: { type: "final" },
        Error: { type: "final" },
      },
      output: ({ context }) =>
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ||
                new UnknownDAError(`No error or signature available`),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    const buildContext = async (arg0: {
      input: BuildTransactionContextTaskArgs;
    }) => new BuildTransactionContextTask(internalApi, arg0.input).run();

    const provideContext = async (arg0: { input: SolanaContextForDevice }) =>
      new ProvideSolanaTransactionContextTask(internalApi, arg0.input).run();

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
      buildContext,
      provideContext,
      signTransaction,
    };
  }
}
