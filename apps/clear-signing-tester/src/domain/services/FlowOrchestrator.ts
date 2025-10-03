import { Observable } from "rxjs";
import { TestResult } from "../types/TestStatus";
import { TransactionInput } from "../models/TransactionInput";
import { TypedDataInput } from "../models/TypedDataInput";

/**
 * Flow orchestrator interface for managing signing flows
 * Provides abstraction for orchestrating transaction and typed data signing flows
 */
export interface FlowOrchestrator {
    /**
     * Orchestrate the signing flow for a transaction or typed data
     * @param observable - Observable stream from device action
     * @param input - Transaction or typed data input
     * @returns Promise<TestResult> - Result of the signing flow
     */
    orchestrateSigningFlow(
        { observable }: { observable: Observable<unknown> },
        input: TransactionInput | TypedDataInput,
    ): Promise<TestResult>;
}
