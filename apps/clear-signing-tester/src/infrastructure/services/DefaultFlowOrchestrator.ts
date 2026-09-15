import {
  DeviceActionStatus,
  LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import {
  debounceTime,
  distinctUntilChanged,
  tap,
  throwError,
  timeout,
} from "rxjs";

import { TYPES } from "@root/src/di/types";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type CliLogLevel } from "@root/src/domain/models/config/LoggerConfig";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type SigningServiceResult } from "@root/src/domain/services/TransactionSigningService";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import { logScreenContents } from "@root/src/domain/utils/screenDebug";
import { CompleteStateHandler } from "@root/src/infrastructure/state-handlers/CompleteStateHandler";
import { ErrorStateHandler } from "@root/src/infrastructure/state-handlers/ErrorStateHandler";
import { OptOutStateHandler } from "@root/src/infrastructure/state-handlers/OptOutStateHandler";
import { SignTransactionStateHandler } from "@root/src/infrastructure/state-handlers/SignTransactionStateHandler";
import { type StateHandlerResult } from "@root/src/infrastructure/state-handlers/StateHandler";

const DEBOUNCE_TIME = 1500;
const SIGN_INACTIVITY_TIMEOUT_MS = 120_000;

/**
 * Default orchestrator for device signing flows.
 *
 * Which {@link UserInteractionRequired} values are considered "signable" is
 * injected via DI (`SignableInteractions`)
 */
@injectable()
export class DefaultFlowOrchestrator implements FlowOrchestrator {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.CompleteStateHandler)
    private readonly completeStateHandler: CompleteStateHandler,
    @inject(TYPES.ErrorStateHandler)
    private readonly errorStateHandler: ErrorStateHandler,
    @inject(TYPES.OptOutStateHandler)
    private readonly optOutStateHandler: OptOutStateHandler,
    @inject(TYPES.SignTransactionStateHandler)
    private readonly signTransactionStateHandler: SignTransactionStateHandler,
    @inject(TYPES.SignableInteractions)
    private readonly signableInteractions: Set<UserInteractionRequired>,
    @inject(TYPES.ScreenReader)
    private readonly screenReader: ScreenReader,
    @inject(TYPES.SpeculinhoConfig)
    private readonly speculinhoConfig: SpeculinhoConfig,
    @inject(TYPES.LogLevel)
    private readonly logLevel: CliLogLevel,
  ) {
    this.logger = loggerFactory("signing-flow-orchestrator");
  }

  async orchestrateSigningFlow(
    { observable }: SigningServiceResult,
    input: SignableInput,
  ): Promise<TestResult> {
    return await new Promise<TestResult>((resolve) => {
      observable
        .pipe(
          tap((state) =>
            this.logger.debug("Raw state", {
              data: {
                state: JSON.stringify(state),
              },
            }),
          ),
          // Apply debounce to prevent processing rapid state changes during device transitions
          // This is especially important for fallback scenarios like blind signing detection
          debounceTime(DEBOUNCE_TIME),
          distinctUntilChanged((prev, curr) => {
            // Consider states identical if they have matching status and interaction type
            // This ignores step number differences to avoid duplicate processing
            return (
              prev?.status === curr?.status &&
              prev?.intermediateValue?.requiredUserInteraction ===
                curr?.intermediateValue?.requiredUserInteraction
            );
          }),
          // Fail fast if the signing flow stalls: a healthy signTx should
          // reach a terminal state well within 2 minutes, so anything beyond
          // that is treated as a stuck flow (e.g. a user-interaction step
          // that never resolves) and bubbled up via the error handler.
          timeout({
            each: SIGN_INACTIVITY_TIMEOUT_MS,
            with: () =>
              throwError(
                () =>
                  new Error(
                    `Signing flow did not progress for ${SIGN_INACTIVITY_TIMEOUT_MS / 1000}s — aborting.`,
                  ),
              ),
          }),
        )
        .subscribe({
          next: (state) => {
            this.handleNext(state, input, resolve).catch((error: unknown) => {
              this.logger.error("Unhandled error while processing state", {
                data: { error },
              });
              resolve({
                input,
                status: "error",
                timestamp: new Date().toISOString(),
                errorMessage:
                  error instanceof Error ? error.message : String(error),
              });
            });
          },
          error: (error: Error) => {
            resolve({
              input,
              status: "error",
              timestamp: new Date().toISOString(),
              errorMessage: error.message,
            });
          },
        });
    });
  }

  private async handleNext(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Device state type is complex and varies
    state: any,
    input: SignableInput,
    resolve: (result: TestResult) => void,
  ): Promise<void> {
    this.logger.debug("Handling state", {
      data: {
        status: state.status,
        requiredUserInteraction:
          state.intermediateValue?.requiredUserInteraction ?? "-",
      },
    });
    if (this.logLevel === "debug") {
      try {
        const events = await this.screenReader.readRawScreenEvents();
        logScreenContents(events, this.speculinhoConfig.device, "signing-flow");
      } catch (error) {
        this.logger.error("Failed to read screen", {
          data: { error: String(error) },
        });
      }
    }

    const result = await this.handleState(state, input);

    if (result.status !== "ongoing") {
      resolve({
        input,
        status: result.status,
        timestamp: new Date().toISOString(),
        errorMessage: result.errorMessage,
      });
    }
  }

  private async handleState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Device state type is complex and varies
    state: any,
    input: SignableInput,
  ) {
    const ongoingResult: StateHandlerResult = {
      status: "ongoing",
    };

    switch (state.status) {
      case DeviceActionStatus.Error:
        this.logger.warn("Device action error", {
          data: {
            error: state.error,
            errorMessage:
              typeof state.error === "object" && state.error !== null
                ? ((state.error as Record<string, unknown>)["message"] ??
                  JSON.stringify(state.error))
                : String(state.error),
          },
        });
        return await this.errorStateHandler.handle({ input });
      case DeviceActionStatus.Completed:
        return await this.completeStateHandler.handle({ input });
      case DeviceActionStatus.Pending: {
        const { requiredUserInteraction } = state.intermediateValue;
        if (this.signableInteractions.has(requiredUserInteraction)) {
          const result = await this.signTransactionStateHandler.handle({
            input,
          });
          return result;
        } else if (
          requiredUserInteraction === UserInteractionRequired.Web3ChecksOptIn
        ) {
          return await this.optOutStateHandler.handle({ input });
        }

        return ongoingResult;
      }
      case DeviceActionStatus.NotStarted:
      case DeviceActionStatus.Stopped:
      default:
        this.logger.debug("Skipping state", {
          data: { state },
        });
        return ongoingResult;
    }
  }
}
