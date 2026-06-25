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
import { Left, Right } from "purify-ts";
import { and, assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
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
import { ProvideWeb3CheckTask } from "@internal/app-binder/task/ProvideWeb3CheckTask";

import { ProvisionBasicClearSignDeviceAction } from "./ProvisionBasicClearSignDeviceAction";
import { ProvisionGenericClearSignDeviceAction } from "./ProvisionGenericClearSignDeviceAction";
import { SignBasicClearSignDeviceAction } from "./SignBasicClearSignDeviceAction";
import { SignGenericClearSignDeviceAction } from "./SignGenericClearSignDeviceAction";

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
  readonly provideWeb3Check: (arg0: {
    input: {
      derivationPath: string;
      transaction: Uint8Array;
      contextModule: ContextModule;
    };
  }) => Promise<void>;
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

    const { getAppConfig, web3CheckOptIn, provideWeb3Check } =
      this.extractDependencies(internalApi);

    const logger = this.getLoggerFactory(internalApi)(
      "SignTransactionDeviceAction",
    );

    const isSupported = (
      feature: keyof typeof SOLANA_FEATURES,
      appConfig: AppConfiguration,
    ): boolean => isSolanaFeatureSupported(internalApi, feature, appConfig);

    // Blockhash refresh is opt-in and shared by both terminal-sign machines:
    // only when `delayed: true` is requested, a blockhash source exists, and
    // the app supports delayed signing. When it isn't allowed we withhold the
    // source so the signing machine signs the original transaction.
    const resolveRefreshSource = (
      context: types["context"],
    ): {
      rpcUrl: string | undefined;
      fetchBlockhash: (() => Promise<Uint8Array>) | undefined;
    } => {
      const rpcUrl = resolveSolanaRpcUrl(context.input);
      const fetchBlockhash = context.input.transactionOptions?.fetchBlockhash;
      const refreshBlockhash =
        context.input.transactionOptions?.delayed === true &&
        !!(rpcUrl || fetchBlockhash) &&
        isSupported("delayedSigning", context._internalState.appConfig!);
      return {
        rpcUrl: refreshBlockhash ? rpcUrl : undefined,
        fetchBlockhash: refreshBlockhash ? fetchBlockhash : undefined,
      };
    };

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
        provideWeb3Check: fromPromise(provideWeb3Check),
        provisionGenericClearSignStateMachine:
          new ProvisionGenericClearSignDeviceAction({
            input: {
              derivationPath: this.input.derivationPath,
              transaction: this.input.transaction,
              contextModule: this.input.contextModule,
            },
            loggerFactory: this.getLoggerFactory(internalApi),
          }).makeStateMachine(internalApi),
        provisionBasicClearSignStateMachine:
          new ProvisionBasicClearSignDeviceAction({
            // `appConfig` is unknown at construction; it is supplied at invoke
            // time (see the BasicClearSign state input below).
            input: {
              derivationPath: this.input.derivationPath,
              transaction: this.input.transaction,
              contextModule: this.input.contextModule,
            },
            loggerFactory: this.getLoggerFactory(internalApi),
          }).makeStateMachine(internalApi),
        signGenericClearSignStateMachine: new SignGenericClearSignDeviceAction({
          input: {
            derivationPath: this.input.derivationPath,
            transaction: this.input.transaction,
          },
          loggerFactory: this.getLoggerFactory(internalApi),
        }).makeStateMachine(internalApi),
        signBasicClearSignStateMachine: new SignBasicClearSignDeviceAction({
          input: {
            derivationPath: this.input.derivationPath,
            transaction: this.input.transaction,
          },
          loggerFactory: this.getLoggerFactory(internalApi),
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
        // The device only runs the scan when the feature is enabled (fresh
        // opt-in this run, or already enabled for a returning user).
        web3ChecksEnabled: ({ context }) =>
          context._internalState.appConfig!.web3ChecksEnabled === true,
        // Generic clear-signing terminates via SIGN MESSAGE DELAYED (0x09) on
        // the original message, so it only needs the capability bit — no RPC /
        // blockhash prerequisite.
        isGenericClearSignAvailable: ({ context }) =>
          isSupported("genericClearSign", context._internalState.appConfig!),
        shouldOptIn: ({ context }) =>
          !context._internalState.appConfig!.web3ChecksEnabled &&
          !context._internalState.appConfig!.web3ChecksOptIn,
        // Generic clear-sign child streamed + finalized the descriptors (its
        // Right("prepared") outcome was folded into the context by the
        // GenericClearSign onDone).
        isClearSignPrepared: ({ context }) =>
          context._internalState.clearSignPrepared,
        hasSignature: ({ context }) =>
          context._internalState.signature !== null,
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
          clearSignPrepared: false,
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
            // When the opt-in isn't run, jump straight to the web3-check gate
            // (the opt-in path rejoins it after Web3ChecksOptInResult).
            {
              target: "Web3Checks",
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
              target: "Web3ChecksOptInResult",
              actions: ({ event }) =>
                logger.info(
                  "[Web3ChecksOptIn] opt-in threw; proceeding without web3checks",
                  { data: { error: event.error } },
                ),
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
              target: "Web3Checks",
            },
          },
        },
        // Web3-checks (transaction scan) provisioning runs here — before the
        // clear-sign branch — so it applies to every sign path (generic,
        // basic, blind) and never disturbs a generic-armed fingerprint.
        Web3Checks: {
          always: [
            {
              target: "Web3ChecksProvide",
              guard: and(["isWeb3ChecksSupported", "web3ChecksEnabled"]),
            },
            { target: "CheckGenericClearSignSupported" },
          ],
        },
        Web3ChecksProvide: {
          entry: assign({
            intermediateValue: () => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: signTransactionDAStateSteps.WEB3_CHECKS_PROVIDE,
            }),
          }),
          invoke: {
            id: "provideWeb3Check",
            src: "provideWeb3Check",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              contextModule: context.input.contextModule,
            }),
            // Best-effort: a failed scan-descriptor stream never blocks signing.
            onDone: { target: "CheckGenericClearSignSupported" },
            onError: {
              target: "CheckGenericClearSignSupported",
              actions: ({ event }) =>
                logger.info("[Web3Checks] provisioning failed; proceeding", {
                  data: { error: event.error },
                }),
            },
          },
        },
        CheckGenericClearSignSupported: {
          always: [
            {
              target: "GenericClearSign",
              guard: and(["noInternalError", "isGenericClearSignAvailable"]),
            },
            { target: "BasicClearSign", guard: "noInternalError" },
            { target: "Error" },
          ],
        },
        // Generic clear-sign child: streams + validates the descriptors (no
        // signing, no UI). `"prepared"` runs the generic terminal sign;
        // `"degraded"` falls back to legacy basic provisioning.
        GenericClearSign: {
          invoke: {
            id: "provisionGenericClearSignStateMachine",
            src: "provisionGenericClearSignStateMachine",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              transaction: context.input.transaction,
              contextModule: context.input.contextModule,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            // Fold the child's Either output into the context here (where
            // xstate types `event.output`), then branch on the context in
            // CheckGenericClearSignResult — no event cast in the guards.
            onDone: {
              target: "CheckGenericClearSignResult",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<SignTransactionDAInternalState>({
                    // Right("prepared") / Right("degraded").
                    Right: (outcome) => ({
                      ...context._internalState,
                      clearSignPrepared: outcome === "prepared",
                    }),
                    // Left never occurs (the prepare phase has no UI), but stay
                    // defensive and surface it.
                    Left: (error) => ({ ...context._internalState, error }),
                  }),
              }),
            },
            onError: {
              target: "BasicClearSign",
              actions: ({ event }) =>
                logger.info(
                  "[ClearSign] generic clear-sign threw; falling back to legacy",
                  { data: { error: event.error } },
                ),
            },
          },
        },
        CheckGenericClearSignResult: {
          always: [
            // Prepared: run the generic terminal sign (prompt + refresh +
            // delayed sign).
            {
              target: "GenericTerminalSign",
              guard: and(["noInternalError", "isClearSignPrepared"]),
            },
            // Degraded (Right("degraded")): fall back to the legacy path.
            { target: "BasicClearSign", guard: "noInternalError" },
            // Defensive: surface an unexpected Left.
            { target: "Error" },
          ],
        },
        // Generic terminal sign: prompt + best-effort blockhash refresh +
        // delayed sign. A user cancel / signing failure surfaces; a non-cancel
        // prompt failure resolves to `"degraded"` and falls back to the legacy
        // basic path.
        GenericTerminalSign: {
          invoke: {
            id: "signGenericClearSignStateMachine",
            src: "signGenericClearSignStateMachine",
            input: ({ context }) => {
              const { rpcUrl, fetchBlockhash } = resolveRefreshSource(context);
              return {
                derivationPath: context.input.derivationPath,
                transaction: context.input.transaction,
                rpcUrl,
                fetchBlockhash,
                userInputType:
                  context.input.transactionOptions?.transactionResolutionContext
                    ?.userInputType,
                blockhashService: context.input.blockhashService,
              };
            },
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: {
              target: "CheckGenericTerminalSignResult",
              actions: assign({
                _internalState: ({ event, context }) =>
                  event.output.caseOf<SignTransactionDAInternalState>({
                    // Right(Signature) on success; Right("degraded") when the
                    // prompt failed for a non-cancel reason (leave signature
                    // unset so the result check falls back to legacy).
                    Right: (signatureOrDegraded) =>
                      signatureOrDegraded === "degraded"
                        ? context._internalState
                        : {
                            ...context._internalState,
                            signature: signatureOrDegraded,
                          },
                    // Left: the user cancelled or signing failed; surface it.
                    Left: (error) => ({ ...context._internalState, error }),
                  }),
              }),
            },
          },
        },
        CheckGenericTerminalSignResult: {
          always: [
            // Signed: done.
            { target: "SignTransactionResultCheck", guard: "hasSignature" },
            // Degraded (no signature, no error): fall back to the legacy path.
            { target: "BasicClearSign", guard: "noInternalError" },
            // User cancel / signing failure: surface.
            { target: "Error" },
          ],
        },
        // Legacy SPL / token provisioning child (best-effort, never signs). It
        // streams descriptors; control always proceeds to the basic terminal
        // sign.
        BasicClearSign: {
          invoke: {
            id: "provisionBasicClearSignStateMachine",
            src: "provisionBasicClearSignStateMachine",
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
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: { target: "BasicTerminalSign" },
            onError: { target: "BasicTerminalSign" },
          },
        },
        // Basic terminal sign: the legacy preview/one-shot path. It decides
        // delayed-vs-one-shot from the blockhash source (opt-in refresh).
        BasicTerminalSign: {
          invoke: {
            id: "signBasicClearSignStateMachine",
            src: "signBasicClearSignStateMachine",
            input: ({ context }) => {
              const { rpcUrl, fetchBlockhash } = resolveRefreshSource(context);
              return {
                derivationPath: context.input.derivationPath,
                transaction: context.input.transaction,
                rpcUrl,
                fetchBlockhash,
                userInputType:
                  context.input.transactionOptions?.transactionResolutionContext
                    ?.userInputType,
                blockhashService: context.input.blockhashService,
              };
            },
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
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

    const provideWeb3Check = async (arg0: {
      input: {
        derivationPath: string;
        transaction: Uint8Array;
        contextModule: ContextModule;
      };
    }) =>
      new ProvideWeb3CheckTask(internalApi, {
        derivationPath: arg0.input.derivationPath,
        transactionBytes: arg0.input.transaction,
        contextModule: arg0.input.contextModule,
        loggerFactory: this.getLoggerFactory(internalApi),
      }).run();

    return {
      getAppConfig,
      web3CheckOptIn,
      provideWeb3Check,
    };
  }
}
