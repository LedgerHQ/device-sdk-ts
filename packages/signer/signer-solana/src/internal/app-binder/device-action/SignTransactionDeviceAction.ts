import {
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
import { assign, fromPromise, setup } from "xstate";

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
} from "@internal/app-binder/services/TransactionInspector";
import { type TxInspectorResult } from "@internal/app-binder/services/utils/transactionDecoders";
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EARgDsAZg4AOPdL37pAFj1WArACYANCACeuh4Y46dxgGzSBnZ6AQZ6dgC+ES5omLgERGxUtAxMrORU3Lz8QiJiUjrySCDKqhkYGtoI+kam5pY29s5uujrSxhzSAJw+AcZWplZ+BlEx6Nj4hCTlKYwsSZwA8opgGMyKirNpC+IQVGAcqBh0FADWBxQraxvComAAsiQAFkdgMkVKKmpUlYjhOhw7F0bAYrAN9HZrC53NV2lZAV1AnYrGEul0wpFoiBYhMEtN2Ft5uUOABhJ5gYinZardabehzdLsABKcAArgJSFI5BpSt8KsUqjoDDoHJ0ug5jAY6jowbZoa0ZYDpHYfA59A47H4BqNseN4lMFoTGZkyRSqVdaUaFizYOzOZJCjyvuVftVhaLuhKpWYZY15QhjADpH4HAMQ0FzOEujqcfrEjN6dtiQBxMCkWkkqgAM3Qu32h2OZwOMHTG0zGBzUHeTrK6gFukDeg4fj04Slwbavis-pFAw4en6wSGfmRXWMMb1k3jBMTRPYHFTpcU5cr4jAOBwFBwHEUAlEWa3AFsOCWM9n0NXiryXfXqo3m627O2-J3+j20RwHIjhiHPAOrIEE5xFO+LJLOxqcIuZ4VugNp2qalJch8JTOnWoBVA4njwv0OiOFYaohNIwY9p4HR+GiGrGNYAEOEEQG4gaCapHOmRQWW55QHBHIIacBTIdeaFaIgmG2CYVi4aGBEBMRLQIKCQY6F0QIigY0iKdGWKxiBhrgQsWSwCsZBxqBGB5hgBxHCc5wFgZFKkMZCyXp8tY-LeEr4f2yKmGOwyGF0JHkRwYQGORxj+C2fgtvRDlMQyek8LZRnaeUa4bluO57qQB44MeRyJfZyXsE5KEufy6HCf0orhAMeg+cF-myfYXSfjYtgiphiLIn40WFWBzEQRwzBZmIOAJYZ9rcleqGueVcmYUYtFdC2spSphPYih0QxLX4gbCqCdiYmMwF4jp-V6UNI1jXZfE1nyroGPNn4GEttggsYa2yUK0iilYSkorRaqqQYIyaZOJ2xUm84XeuV1kFIDj8dNZVCXNtFPS9K3vc0MLSRwXQhFqkZKYpOg9eDM5ncSABCrKoAIEDlmImicns5kFlZBwAEa0-TjNgMzxUCTNKNhDYn5jqpA6guJB3rWjNiOARX74-YZOMRTcXUzzDNUEznLrpu267vuR4cNzdM6xgeuC0j922E2X6SuYkpgrhdj+hYzUONY-QK8Y4o7Wr059Zr84AAqbgwEBgHzzNmRZhbWYokeoNHsekDbpWuvhYWAp4in9Pj4r2OtWr9p4yIE-0YXjqDx3qyHkOZBHFBRzHuv8-raVG5l2XHsnrep+3Vud5nd23jnHSOJ7he1aG7uyf40h48Dr3CgdAGHbq9fBzQunEi3bfp1xpA8Uht03rNCvYQO3T+IMIbrRYJhLUC3syvtQcmVaB8p2nHfMxPmfB0iMs4T2qiYW+PkH7Y10ERUUkUHBam9GqZEIMjoMV3j-ecWlyZUHjuzIsHBVA7xMmPS+KNHCSiCsCMEAQfRjhIgObwL4vwahJqwr+p1Q6ZFwQ3UyBt0rGyyqbEhmCyGTWcuPWaVCjDPTBEMcwalGGfRFMvf2cIBwqk1L4LhEMWKcD4bvIB5JELkMElUYIyJvDBEijYF8wweyqQ6OYAIkJhT6DClvIx39944LBvwkxZobpTTATIiBuECb2J0I4z6SCEEFzsO9NErZAxRCxBgCg0d4DFB8dwpuyMhbIyqAAWj8P6Epdg8ZohqbUmpX49EawKVkNQghbhiAvhYxA+EArwnIm0b6SC1JmG8QErBfjMjUmuHSSmgkin3QOs2bo5hHDbXEjoHswZl5fkUphAZ-gkGNMbgY0kpjzQ0g2NgqgJ9OnC0FERZerZES7X2Z4dawZOiPjaMYTUoUjl71maxNM0FKy3OKboSEP0RQ+HCFY-GsDqioI4DVAI3skn-FGaQ-JJy2LLg4kEykYLXTew1J0B6L5HCr1qgYJh2yLAqnaL4XCwN-lXM4LDAqeDCm2zckMKpMSVK-RbCFZUJEnzIuGe-GqIRSZ13Ediga0NRqEHGkS28qkdotQOWGQMxgSKIhMH0A6oIgieAcKyiZnAaYW3Tmq2a0sqnkWRJqAYalgx6E2QazxIq1IDCBhawFnBD5D1taE6RIs-rNlWU+HwQRIrlNUe0Zs1cJTKk1GYbqcqYpNJOcG-+I9AFsm4mcu1KMwRKRMFjcILZgw-NLkYIYpgQqBkhHoUMAaeGGLGSZUtVRfr2G8PjKiwIwiYQRe1JsT4-rPVwuib6Hbml5PKAS04vbECjkeb9SlkklINRhCKD8Wpfb+13WqTNGDs3HIGsgVkxAmCwByVIihlixzwlahiFUQo926FUthX0iJ8K-Xmguk5ABRbua6EBAn6Mi1sH7Y3foQIYJsQR1n42VEKRw6SIhAA */
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
            { target: "InspectTransaction", guard: "noInternalError" },
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
                _internalState: ({ context, event }) => ({
                  ...context._internalState,
                  inspectorResult: event.output,
                }),
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
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
      Promise.resolve(
        new TransactionInspector(
          arg0.serializedTransaction,
        ).inspectTransactionType(),
      );

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
