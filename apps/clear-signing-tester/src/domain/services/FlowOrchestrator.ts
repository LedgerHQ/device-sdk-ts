import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type TestResult } from "@root/src/domain/types/TestStatus";

import { type SigningServiceResult } from "./SigningService";

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
    { observable }: SigningServiceResult,
    input: TransactionInput | TypedDataInput,
  ): Promise<TestResult>;
}
