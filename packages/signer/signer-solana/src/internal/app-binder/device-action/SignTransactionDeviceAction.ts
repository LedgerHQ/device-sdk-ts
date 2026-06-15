import { type ContextModule } from "@ledgerhq/context-module";
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
import { type Either, Left, Right } from "purify-ts";
import { and, assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
  type SignTransactionDAStateStep,
  signTransactionDAStateSteps,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { GetAppConfigurationCommand } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  Web3CheckOptInCommand,
  type Web3CheckOptInCommandResponse,
} from "@internal/app-binder/command/Web3CheckOptInCommand";
import { APP_NAME } from "@internal/app-binder/constants";
import {
  isSolanaFeatureSupported,
  type SOLANA_FEATURES,
} from "@internal/app-binder/SolanaApplicationResolver";

import {
  type GenericClearSignDAError,
  type GenericClearSignDAOutput,
  GenericClearSignDeviceAction,
} from "./GenericClearSignDeviceAction";
import { ShallowClearSignDeviceAction } from "./ShallowClearSignDeviceAction";
import { SigningOperationsDeviceAction } from "./SigningOperationsDeviceAction";

/**
 * Per-sign `transactionOptions.solanaRPCURL` overrides the builder default
 * (`input.solanaRPCURL`) for inspection and delayed signing.
 */
function resolveSolanaRpcUrl(
  input: SignTransactionDAInput,
): string | undefined {
  return input.transactionOptions?.solanaRPCURL ?? input.solanaRPCURL;
}

export type MachineDependencies = {
  readonly getAppConfig: () => Promise<
    CommandResult<AppConfiguration, SolanaAppErrorCodes>
  >;
  readonly web3CheckOptIn: () => Promise<
    CommandResult<Web3CheckOptInCommandResponse, SolanaAppErrorCodes>
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

    const { getAppConfig, web3CheckOptIn } =
      this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "SignTransactionDeviceAction",
    );

    const isSupported = (
      feature: keyof typeof SOLANA_FEATURES,
      appConfig: AppConfiguration,
    ): boolean => isSolanaFeatureSupported(internalApi, feature, appConfig);

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
        getAppConfig: fromPromise(getAppConfig),
        web3CheckOptIn: fromPromise(web3CheckOptIn),
        genericClearSignStateMachine: new GenericClearSignDeviceAction({
          input: {
            derivationPath: "",
            transaction: new Uint8Array(),
            contextModule: undefined as unknown as ContextModule,
          },
        }).makeStateMachine(internalApi),
        shallowClearSignStateMachine: new ShallowClearSignDeviceAction({
          input: {
            derivationPath: "",
            transaction: new Uint8Array(),
            contextModule: undefined as unknown as ContextModule,
            appConfig: undefined as unknown as AppConfiguration,
          },
        }).makeStateMachine(internalApi),
        signingOperationsStateMachine: new SigningOperationsDeviceAction({
          input: {
            derivationPath: "",
            transaction: new Uint8Array(),
          },
        }).makeStateMachine(internalApi),
      },
      guards: {
        noInternalError: ({ context }) => context._internalState.error === null,
        skipOpenApp: ({ context }) =>
          context.input.transactionOptions?.skipOpenApp || false,
        isSPLSupported: ({ context }) =>
          isSupported("spl", context._internalState.appConfig!),
        isWeb3ChecksSupported: ({ context }) =>
          isSupported("web3Checks", context._internalState.appConfig!),
        // Generic clear-signing terminates via SIGN MESSAGE DELAYED (0x09) on
        // the original message, so it only needs the capability bit — no RPC /
        // blockhash prerequisite.
        isGenericClearSignAvailable: ({ context }) =>
          isSupported("genericClearSign", context._internalState.appConfig!),
        shouldOptIn: ({ context }) =>
          !context._internalState.appConfig!.web3ChecksEnabled &&
          !context._internalState.appConfig!.web3ChecksOptIn,
        // Generic clear-sign child armed the device (Right("armed")).
        isGenericClearSignArmed: ({ event }) => {
          const output = (
            event as unknown as {
              output: Either<GenericClearSignDAError, GenericClearSignDAOutput>;
            }
          ).output;
          return output.isRight() && output.unsafeCoerce() === "armed";
        },
        // Generic clear-sign child surfaced a user cancel (Left).
        isGenericClearSignCancelled: ({ event }) =>
          (
            event as unknown as {
              output: Either<GenericClearSignDAError, GenericClearSignDAOutput>;
            }
          ).output.isLeft(),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QGUCWUB2AVATgQw1jwGMAXVAewwBEwA3VYsAQTMowDoBJDVcvADbJSeUmADEAbQAMAXUSgADhVh92CkAA9EARgDsAZg4AOAJzSAbAYAsOgKymdN08YA0IAJ67LxjnbvWxjoW-kGGxgC+Ee5omLgERGxUtAxMrORU3Lz8QiJiUjrySCDKqhkYGtoI+kZmljb2js5unojmRgbS1haG0o5OllEx6Nj4hCTlKYwsSZwA8opgGMyKilNps+IQVGAcqBh0FADWuxSLy6vComAAsiQAFvtgMkVKKmpUlYh6dgBMHL8bJ0LKY7AZOr87O4vAhjHpTCZfkEDHo+nprL8ekMQLFRgkJux1jNyhwFksVooAEpwACuAlIAGF7mBiEcpHINKUPhVilUdL9gn5TCjfr9rNJ+X8WjDzAi9AKDGLwb94RZrNjcfFxrMiel2KTzhTqbA6YzmayCq8Su9yl9qgKLEKRWKJZCkdDEEE-NIffLAX8LPUNSMtYlJvRpnrMgBxMCkCkMqgAM3QWx2ewOx12MHjq0TGBTUBenJt6l5uj9JmsBjhxjhdn0pg91S61gB1kCPT0aosxiRwbiYzDhIjGxJsdzinzhfEYBwOAoOA4igEoiTi4Athwcwnk+hi8Uubby9VK8Zq7X643m78fRwfT7+fCxQ2B3jteHUsT9RPdwX0MappMiybIHm8ZRlqAVQCuYHAWJClj8qYSpQq0LZ6HoHA2D2PpwuCphvqGBLJKO34xnGf6FoB9LARakiFCWEGfCeMHSHBCEWEhKHNt2dj3ghdh9FYgLGHYhFDsRNCkVGnC-nme5QNRZogVIvxWkekFaIgrHsYJnG-Mh1aoTCDQcKYvG9sYaIuJE0Q4iGEk6tJswcAA6mAABGBi0UcsALKQPBphguz7IcJwcAA7p53nmkc-k8GB1pMTyUHaRh-zdHCpjVtInSic2dZGH8gmoi4lmQuJ+JOV+MludFPl+YoAUYLO86Lsuq6kOuOBblFXk+fFGCJRpzGpQgKryhwmXwjleXGd4k3WGCOhWd29g-BYlUfiONUue5-WxY1zVKeImiwHkux4EmYg4AAFNIACU4iao5n6Rnt9WHYNSnDaWo1aQgiqQhwqqmNlxUqrlzaOAi1h6H2KLLZCK1bcOJG7SSPmxsFOCMAyAhgHgOC4sgNKrIuYgQOy6l-SlAMGBYgYg6YjM-NYoLSGC80IMh-yBgYwTwqJ5l2HoqOSbqLlY0sc54wTRMk2Tyg4JTlqMdydoM0zqo9AEHNc82elTd28F1qtnTouL1XvZjsXY7LxD44TxMjKT5Mq5Aqk08lmuM2xOts-rBjc90bFwyEZvgh2KpiXZL1VW9Y4-jLuOO-LLuYEFIWZuFMA43LzskxddzEI8wW-T7J4YmDJjooYir2DY0OdMbjNiuiGIqgRccOQnO028n+dp4XIxZxmYXZinBcK67xcPE89HexrVcGQicJw8qjfWM28FtuZjOBOY1borZwyDn36MD+RQ9OzPmfbMF49ZtuU-D3fGBXGIJdl88anq8eY1q5rzrpvME280J1n+PvUWDgVril+FbROZFZKv1vhnFqc4FxLhXGuTcL8b7pyLtcb+C8OSHlpnaIBtcN4NzATxeGAJMRWF7EqCUBhEH9yTpkZA9xBACAoBFNBuIx6hWfrAXhAh+GCMIbPYh89y5kPAsvMaxUdB+G6I4eEAtpB1m5kEXwDMXDaN7HoHQwQOGXy4ZwHhfCBFCNHpg9qOCup4PEbY6RI9MCf1uPI54iikrKIBqo9RIJGzaN0fQtixgQTw1FBiXRYse7n22pY5BHAsBzg3PsQQwiH7ZwnhwVQmB9hQDJPgcosBvEkIUUvABQTsqYWkBhdENhzxql+DxUEcFqyr26Bibs3cz7vjRlJDG+p44pIwEpHy1N-6aSqCEQUQIGbymMOCMEBVgZgjVNEkELNuixyGURa2ViOATJGdM2KatyGVzGosx0yyehInWQYehCJtkdkZn8YO0Soh2QwBQCAcANDnIls5OpI06ZVAALQWGbLC+8D4kXIrVBY0ZV9OA8DUDki6cz-pVAxM2HQlg2I1hmtIES61Bn2WSSMyWJIyQXDWOCzSkLNZ2EdICasAs-imIMKCAq-g-ABHgv0Wwok0X0v1Iyo0tIaKxTxVC7wFL7z2EEsEUWcNuzQwlMKjewozDNJ0JKll5FJzTnQIqu0OhxSYQbKLLogJ4agleWhYlxKTB1iaYZDsARDk0uGWCsZZrKIATlcpVkVqTw6GFP7FmoIBQrTWToIllg+LmRtaiTmqJlQmuDZwfaMUQJHR4FGsaYonAg1yhCBs2VGapv5feFm-K4lOA3nmjFdUDrFu+uGstAMDJmA4MS8GQRRSKnMgVbKZl4Z9H5KKJEgQO2nOlgQzxH8lYU0gP2qoUc+JjvZhKZC8E4VoX6Iw5EfY4nVmNUkwNJy0n21TvYzAO7EA1jWdQn4GEzD6HlAVOEJgwS3lwvG9hd7jlINqjYyRdiZGvpuYEglok+Iit3lYfoKa0ImzMsBroyF9BxOXWkjJPVslCBGG+hA-gGz3lncLMUBlXUwnhm2Qx0SNrBHMtS0FD7oO90mZckCVH4J-DMgKeUIQwHswKvoLCeyJQbXgvKYj0GaTECYLAeAiG6kLPlJhTEgR5QNxVMxz0oo-AM26PBYI-KzGqZcgAUTajgET+mAQ7OMwKUzzYlqYXDhytZ6q8Lqj+UAA */
      id: "SignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: signTransactionDAStateSteps.OPEN_APP,
        },
        _internalState: {
          error: null,
          signature: null,
          appConfig: null,
          clearSignArmed: false,
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
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.OPEN_APP,
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
                  step: signTransactionDAStateSteps.OPEN_APP,
                }),
              }),
            },
            onDone: {
              target: "OpenAppResultCheck",
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
        OpenAppResultCheck: {
          always: [
            { target: "GetAppConfig", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        GetAppConfig: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.GET_APP_CONFIG,
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
              target: "Web3ChecksOptIn",
              guard: and([
                "noInternalError",
                "isWeb3ChecksSupported",
                "shouldOptIn",
              ]),
            },
            // When web3-checks aren't run, still evaluate the clear-sign gate
            // (the web3 opt-in path rejoins it after Web3ChecksOptInResult).
            {
              target: "CheckGenericClearSignSupported",
              guard: "noInternalError",
            },
            { target: "Error" },
          ],
        },
        Web3ChecksOptIn: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.Web3ChecksOptIn,
              step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN,
            }),
          }),
          invoke: {
            id: "web3CheckOptIn",
            src: "web3CheckOptIn",
            onDone: {
              target: "Web3ChecksOptInResult",
              actions: [
                ({ event }) => {
                  if (!isSuccessCommandResult(event.output)) {
                    logger.warn(
                      "[Web3ChecksOptIn] opt-in command returned error, proceeding without web3checks",
                      { data: { error: event.output } },
                    );
                  }
                },
                assign({
                  _internalState: ({ event, context }) => {
                    if (isSuccessCommandResult(event.output)) {
                      return {
                        ...context._internalState,
                        appConfig: {
                          ...context._internalState.appConfig!,
                          web3ChecksEnabled: event.output.data.enabled,
                        },
                      };
                    }
                    return context._internalState;
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
        Web3ChecksOptInResult: {
          entry: assign(({ context }) => ({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN_RESULT,
              result: context._internalState.appConfig!.web3ChecksEnabled!,
            },
          })),
          // Zero-delay transition: ensures the entry assign above is visible to
          // onSnapshot observers before the machine moves on to the gate.
          after: {
            0: {
              target: "CheckGenericClearSignSupported",
            },
          },
        },
        CheckGenericClearSignSupported: {
          always: [
            {
              target: "GenericClearSign",
              guard: and(["noInternalError", "isGenericClearSignAvailable"]),
            },
            { target: "ShallowClearSign", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Generic clear-sign child: prepares + arms the device (no signing).
        // `"armed"` → terminal sign; `"degraded"` → legacy shallow provisioning;
        // `Left` → user cancel (surface).
        GenericClearSign: {
          invoke: {
            id: "genericClearSignStateMachine",
            src: "genericClearSignStateMachine",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              contextModule: context.input.contextModule,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  ({
                    requiredUserInteraction:
                      event.snapshot.context.intermediateValue
                        .requiredUserInteraction,

                    step: event.snapshot.context.intermediateValue
                      .step as SignTransactionDAStateStep,
                  }) as SignTransactionDAIntermediateValue,
              }),
            },
            onDone: [
              {
                // Armed: run the terminal sign (skips preview, refreshes the
                // blockhash when possible).
                target: "TerminalSign",
                guard: "isGenericClearSignArmed",
                actions: assign({
                  _internalState: ({ context }) => ({
                    ...context._internalState,
                    clearSignArmed: true,
                  }),
                }),
              },
              {
                // User cancel: surface, never fall back.
                target: "Error",
                guard: "isGenericClearSignCancelled",
                actions: assign({
                  _internalState: ({ event, context }) =>
                    event.output.caseOf({
                      Left: (error) => ({ ...context._internalState, error }),
                      Right: () => context._internalState,
                    }),
                }),
              },
              // Degraded (`Right("degraded")`): fall back to the legacy path.
              { target: "ShallowClearSign" },
            ],
            onError: {
              target: "ShallowClearSign",
              actions: ({ event }) =>
                logger.info(
                  "[ClearSign] generic clear-sign threw; falling back to legacy",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        // Legacy SPL / token provisioning child (best-effort, never signs). It
        // streams descriptors; control always proceeds to the terminal sign.
        ShallowClearSign: {
          invoke: {
            id: "shallowClearSignStateMachine",
            src: "shallowClearSignStateMachine",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              contextModule: context.input.contextModule,
              appConfig: context._internalState.appConfig!,
              rpcUrl: resolveSolanaRpcUrl(context.input),
              resolutionContext:
                context.input.transactionOptions?.transactionResolutionContext,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  ({
                    requiredUserInteraction:
                      event.snapshot.context.intermediateValue
                        .requiredUserInteraction,

                    step: event.snapshot.context.intermediateValue
                      .step as SignTransactionDAStateStep,
                  }) as SignTransactionDAIntermediateValue,
              }),
            },
            onDone: { target: "TerminalSign" },
            onError: { target: "TerminalSign" },
          },
        },
        // Single terminal sign via the signing-operations machine.
        // `clearSignArmed` (set by the generic path) skips its preview;
        // otherwise the machine decides delayed-vs-one-shot from the blockhash
        // source.
        TerminalSign: {
          invoke: {
            id: "signingOperationsStateMachine",
            src: "signingOperationsStateMachine",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              rpcUrl: resolveSolanaRpcUrl(context.input),
              fetchBlockhash: context.input.transactionOptions?.fetchBlockhash,
              userInputType:
                context.input.transactionOptions?.transactionResolutionContext
                  ?.userInputType,
              blockhashService: context.input.blockhashService,
              alreadyArmed: context._internalState.clearSignArmed,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  ({
                    requiredUserInteraction:
                      event.snapshot.context.intermediateValue
                        .requiredUserInteraction,

                    step: event.snapshot.context.intermediateValue
                      .step as SignTransactionDAStateStep,
                  }) as SignTransactionDAIntermediateValue,
              }),
            },
            onDone: {
              target: "SignTransactionResultCheck",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<SignTransactionDAInternalState>({
                    Right: (signature) => ({
                      ...context._internalState,
                      signature,
                    }),
                    Left: (error) => ({ ...context._internalState, error }),
                  }),
              }),
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

    const web3CheckOptIn = async () =>
      internalApi.sendCommand(new Web3CheckOptInCommand());

    return {
      getAppConfig,
      web3CheckOptIn,
    };
  }
}
