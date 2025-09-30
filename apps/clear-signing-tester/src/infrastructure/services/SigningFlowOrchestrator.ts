import { TYPES } from "@root/src/di/types";
import { inject, injectable } from "inversify";
import {
    DeviceActionStatus,
    LoggerPublisherService,
    UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { TestResult } from "@root/src/domain/types/TestStatus";
import { TransactionInput } from "@root/src/domain/models/TransactionInput";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { CompleteStateHandler } from "./state-handlers/CompleteStateHandler";
import { OptOutStateHandler } from "./state-handlers/OptOutStateHandler";
import { ErrorStateHandler } from "./state-handlers/ErrorStateHandler";
import { SignTransactionStateHandler } from "./state-handlers/SignTransactionStateHandler";
import { debounceTime, distinctUntilChanged, Observable, tap } from "rxjs";
import { StateHandlerResult } from "./state-handlers/StateHandler";

const DEBOUNCE_TIME = 1500;

@injectable()
export class SigningFlowOrchestrator {
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
        { observable }: { observable: Observable<unknown> },
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
                    // Use a debounce time to let the device stabilize like fallback to blind signing
                    debounceTime(DEBOUNCE_TIME),
                    distinctUntilChanged((prev: any, curr: any) => {
                        // Consider states the same if they have the same status and interaction type
                        // regardless of step differences
                        return (
                            prev?.status === curr?.status &&
                            prev?.intermediateValue?.requiredUserInteraction ===
                                curr?.intermediateValue?.requiredUserInteraction
                        );
                    }),
                )
                .subscribe({
                    next: async (state: any) => {
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
                    error: (error: any) => {
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
            case DeviceActionStatus.Pending:
                const { requiredUserInteraction } = state.intermediateValue;
                if (
                    requiredUserInteraction ===
                        UserInteractionRequired.SignTransaction ||
                    requiredUserInteraction ===
                        UserInteractionRequired.SignTypedData
                ) {
                    const result =
                        await this.signTransactionStateHandler.handle({
                            input,
                        });
                    return result;
                } else if (
                    requiredUserInteraction ===
                    UserInteractionRequired.Web3ChecksOptIn
                ) {
                    return await this.optOutStateHandler.handle({ input });
                }

                return ongoingResult;
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
