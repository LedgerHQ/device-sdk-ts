import {
  type CommandResult,
  type DeviceActionStateMachine,
  DeviceSessionStateType,
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
import { APP_NAME } from "@internal/app-binder/constants";
import {
  type NormalizedTransactionInput,
  TransactionInputNormaliser,
} from "@internal/app-binder/services/TransactionInputNormaliser";
import {
  isSolanaSignerFeatureSupported,
  type SolanaSignerFeaturesNames,
} from "@internal/app-binder/SolanaApplicationResolver";
import {
  SolanaSigningReportTask,
  type SolanaSigningReportTaskArgs,
} from "@internal/app-binder/task/SolanaSigningReportTask";

import { ProvisionBasicClearSignDeviceAction } from "./ProvisionBasicClearSignDeviceAction";
import { ProvisionGenericClearSignDeviceAction } from "./ProvisionGenericClearSignDeviceAction";
import { ProvisionTransactionCheckDeviceAction } from "./ProvisionTransactionCheckDeviceAction";
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
  readonly normalizeTransaction: () => Promise<NormalizedTransactionInput>;
  readonly getAppConfig: () => Promise<
    CommandResult<AppConfiguration, SolanaAppErrorCodes>
  >;
  readonly reportSign: (arg0: {
    input: SolanaSigningReportTaskArgs;
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

    const { normalizeTransaction, getAppConfig, reportSign } =
      this.extractDependencies(internalApi);

    const loggerFactory = this.getLoggerFactory(internalApi);
    const logger = loggerFactory("SignTransactionDeviceAction");

    const disabledFeaturesSet:
      | ReadonlySet<SolanaSignerFeaturesNames>
      | undefined = this.input.disabledFeatures
      ? new Set(this.input.disabledFeatures)
      : undefined;

    const isSupported = (
      feature: SolanaSignerFeaturesNames,
      appConfig: AppConfiguration,
    ): boolean =>
      isSolanaSignerFeatureSupported(
        internalApi,
        feature,
        appConfig,
        disabledFeaturesSet,
      );

    // Blockhash refresh is opt-in and shared by both terminal-sign machines:
    // only when `delayed: true` is requested, a blockhash source exists, and
    // the app supports delayed signing. When it isn't allowed we withhold the
    // source so the signing machine signs the original transaction.
    //
    // Template-based swaps (LiFi, etc.) always sign with the original blockhash:
    // CAL-provided e016 descriptors are computed for the original transaction, so
    // refreshing the blockhash would invalidate them and make the Exchange app
    // reject the sign with a descriptor-mismatch error.
    const resolveRefreshSource = (
      context: types["context"],
    ): {
      rpcUrl: string | undefined;
      fetchBlockhash: (() => Promise<Uint8Array>) | undefined;
    } => {
      const rpcUrl = resolveSolanaRpcUrl(context.input);
      const fetchBlockhash = context.input.transactionOptions?.fetchBlockhash;
      const isTemplateSwap =
        !!context.input.transactionOptions?.transactionResolutionContext
          ?.templateId;
      const refreshBlockhash =
        !isTemplateSwap &&
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
        normalizeTransaction: fromPromise(normalizeTransaction),
        reportSign: fromPromise(reportSign),
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
        getAppConfig: fromPromise(getAppConfig),
        transactionCheckStateMachine: new ProvisionTransactionCheckDeviceAction(
          {
            input: {
              derivationPath: this.input.derivationPath,
              transaction: this.input.transaction,
              contextModule: this.input.contextModule,
            },
            loggerFactory: this.getLoggerFactory(internalApi),
          },
        ).makeStateMachine(internalApi),
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
        isTransactionChecksSupported: ({ context }) =>
          isSupported("transactionChecks", context._internalState.appConfig!),
        // Generic clear-signing terminates via SIGN MESSAGE DELAYED (0x09) on
        // the original message, so it only needs the capability bit — no RPC /
        // blockhash prerequisite.
        isGenericClearSignAvailable: ({ context }) =>
          isSupported("genericClearSign", context._internalState.appConfig!),
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
      initial: "NormalizeTransaction",
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
          messageBytes: this.input.transaction,
          serializedForTxCheck: undefined,
          clearSignPrepared: false,
          unrecognizedProgramIds: [],
        },
      }),
      states: {
        NormalizeTransaction: {
          // Emit the correct first step immediately so the snapshot produced
          // while the actor runs already reflects where we are headed.
          entry: assign({
            intermediateValue: ({ context }) => ({
              requiredUserInteraction: UserInteractionRequired.None,
              step: context.input.transactionOptions?.skipOpenApp
                ? signTransactionDAStateSteps.GET_APP_CONFIG
                : signTransactionDAStateSteps.OPEN_APP,
            }),
          }),
          invoke: {
            id: "normalizeTransaction",
            src: "normalizeTransaction",
            onDone: [
              {
                target: "GetAppConfig",
                guard: "skipOpenApp",
                actions: assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    messageBytes: event.output.messageBytes,
                    serializedForTxCheck: event.output.serializedForTxCheck,
                  }),
                }),
              },
              {
                target: "OpenAppDeviceAction",
                actions: assign({
                  _internalState: ({ event, context }) => ({
                    ...context._internalState,
                    messageBytes: event.output.messageBytes,
                    serializedForTxCheck: event.output.serializedForTxCheck,
                  }),
                }),
              },
            ],
          },
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
              target: "CheckTransactionCheckSupported",
              guard: "noInternalError",
            },
            { target: "Error" },
          ],
        },
        CheckTransactionCheckSupported: {
          always: [
            // Feature supported: delegate opt-in + provide to the child machine.
            {
              target: "TxCheck",
              guard: "isTransactionChecksSupported",
            },
            // Feature not supported: skip the child machine entirely.
            { target: "CheckGenericClearSignSupported" },
          ],
        },
        // Web3-checks child machine: handles opt-in prompt and scan-descriptor
        // provisioning. Only reached when the feature is supported; opt-in and
        // provide decisions are made internally.
        TxCheck: {
          invoke: {
            id: "transactionCheckStateMachine",
            src: "transactionCheckStateMachine",
            input: ({ context }) => {
              // The scan descriptor must hash the same message the device will
              // sign. The terminal sign only zeroes the blockhash when it
              // refreshes it (delayed signing); otherwise it signs the original.
              const { rpcUrl, fetchBlockhash } = resolveRefreshSource(context);
              return {
                appConfig: context._internalState.appConfig!,
                derivationPath: context.input.derivationPath,
                transaction: context._internalState.messageBytes,
                contextModule: context.input.contextModule,
                isBlockhashRefreshNeeded:
                  rpcUrl !== undefined || fetchBlockhash !== undefined,
                serializedForTxCheck:
                  context._internalState.serializedForTxCheck,
              };
            },
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) =>
                  event.snapshot.context.intermediateValue,
              }),
            },
            onDone: { target: "CheckGenericClearSignSupported" },
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
              transaction: context._internalState.messageBytes,
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
                    Right: (outcome) => ({
                      ...context._internalState,
                      clearSignPrepared: outcome.status === "prepared",
                      unrecognizedProgramIds: outcome.unrecognizedProgramIds,
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
                  { data: { error: String(event.error) } },
                ),
            },
          },
        },
        CheckGenericClearSignResult: {
          always: [
            // Prepared: run the generic terminal sign; report fires after.
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
                transaction: context._internalState.messageBytes,
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
            // Signed: report (isBlindSign: false) then surface result.
            { target: "Report", guard: "hasSignature" },
            // Degraded (no signature, no error): fall back to the legacy path.
            { target: "BasicClearSign", guard: "noInternalError" },
            // User cancel / signing failure: report (isBlindSign: false) then surface error.
            { target: "Report" },
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
              transaction: context._internalState.messageBytes,
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
            onDone: { target: "Report" },
            onError: { target: "Report" },
          },
        },
        // Single report state for all paths.
        // isBlindSign is derived from context: false when a signature or error is
        // already set (clear-sign path — success or cancel), true otherwise
        // (basic/legacy path, neither has run yet).
        // Routes to: SignTransactionResultCheck (clear-sign success),
        //            Error (clear-sign cancel/failure), or
        //            BasicTerminalSign (basic path).
        Report: {
          invoke: {
            src: "reportSign",
            input: ({ context }) => {
              const sessionState = internalApi.getDeviceSessionState();
              const deviceVersion =
                sessionState.sessionStateType !==
                DeviceSessionStateType.Connected
                  ? (sessionState.firmwareVersion?.os ?? null)
                  : null;
              return {
                isBlindSign:
                  context._internalState.signature === null &&
                  context._internalState.error === null,
                messageBytes: context._internalState.messageBytes,
                unrecognizedProgramIds:
                  context._internalState.unrecognizedProgramIds,
                contextModule: context.input.contextModule,
                signerAppVersion: context._internalState.appConfig!.version,
                deviceModelId: sessionState.deviceModelId,
                deviceVersion,
                loggerFactory,
              } satisfies SolanaSigningReportTaskArgs;
            },
            onDone: [
              {
                target: "SignTransactionResultCheck",
                guard: "hasSignature",
              },
              {
                target: "Error",
                guard: ({ context }) => context._internalState.error !== null,
              },
              { target: "BasicTerminalSign" },
            ],
            onError: [
              {
                target: "SignTransactionResultCheck",
                guard: "hasSignature",
              },
              {
                target: "Error",
                guard: ({ context }) => context._internalState.error !== null,
              },
              { target: "BasicTerminalSign" },
            ],
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
                transaction: context._internalState.messageBytes,
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
    const normalizeTransaction = async () => {
      try {
        return new TransactionInputNormaliser().normalize(
          this.input.transaction,
        );
      } catch (error) {
        this.getLoggerFactory(internalApi)("NormalizeTransaction").warn(
          "[normalizeTransaction] format detection failed; treating input as message bytes",
          { data: { error: String(error) } },
        );
        return {
          messageBytes: this.input.transaction,
          serializedForTxCheck: undefined,
        };
      }
    };

    const getAppConfig = async () =>
      internalApi.sendCommand(new GetAppConfigurationCommand());

    const reportSign = async (arg0: { input: SolanaSigningReportTaskArgs }) =>
      new SolanaSigningReportTask(arg0.input).run();

    return {
      normalizeTransaction,
      getAppConfig,
      reportSign,
    };
  }
}
