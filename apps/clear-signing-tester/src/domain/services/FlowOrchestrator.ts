import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { type TestResult } from "@root/src/domain/types/TestStatus";

import { type SigningServiceResult } from "./TransactionSigningService";

/** Orchestrates the device signing flow for any {@link SignableInput} type. */
export interface FlowOrchestrator {
  /**
   * Subscribe to a signing device-action observable and drive the device
   * through its screen states until a final {@link TestResult} is produced.
   *
   * @param observable - Observable stream emitted by the signing device action.
   * @param input - The signing input being tested.
   */
  orchestrateSigningFlow(
    { observable }: SigningServiceResult,
    input: SignableInput,
  ): Promise<TestResult>;
}
