import {
  DeviceActionStatus,
  LoggerPublisherService,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { debounceTime, distinctUntilChanged, tap } from "rxjs";

import { TYPES } from "@root/src/di/types";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type SigningServiceResult } from "@root/src/domain/services/SigningService";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import { CompleteStateHandler } from "@root/src/infrastructure/state-handlers/CompleteStateHandler";
import { ErrorStateHandler } from "@root/src/infrastructure/state-handlers/ErrorStateHandler";
import { OptOutStateHandler } from "@root/src/infrastructure/state-handlers/OptOutStateHandler";
import { SignTransactionStateHandler } from "@root/src/infrastructure/state-handlers/SignTransactionStateHandler";
import { type StateHandlerResult } from "@root/src/infrastructure/state-handlers/StateHandler";

const DEBOUNCE_TIME = 1500;

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
  ) {
    this.logger = loggerFactory("signing-flow-orchestrator");
  }

  async orchestrateSigningFlow(
    { observable }: SigningServiceResult,
    input: TransactionInput | TypedDataInput,
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
        )
        .subscribe({
          next: async (state) => {
            this.logger.debug("Handling state", {
              data: { state: JSON.stringify(state) },
            });
            const result = await this.handleState(state, input);

            if (result.status !== "ongoing") {
              resolve({
                input,
                status: result.status,
                timestamp: new Date().toISOString(),
                errorMessage: result.errorMessage,
              });
            }
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

  private async handleState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Device state type is complex and varies
    state: any,
    input: TransactionInput | TypedDataInput,
  ) {
    const ongoingResult: StateHandlerResult = {
      status: "ongoing",
    };

    switch (state.status) {
      case DeviceActionStatus.Error:
        return await this.errorStateHandler.handle({ input });
      case DeviceActionStatus.Completed:
        return await this.completeStateHandler.handle({ input });
      case DeviceActionStatus.Pending: {
        const { requiredUserInteraction } = state.intermediateValue;
        if (
          requiredUserInteraction === UserInteractionRequired.SignTransaction ||
          requiredUserInteraction === UserInteractionRequired.SignTypedData
        ) {
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
