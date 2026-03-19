import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { type TestResult } from "@root/src/domain/types/TestStatus";

import { type SigningServiceResult } from "./TransactionSigningService";

export interface FlowOrchestrator {
  orchestrateSigningFlow(
    { observable }: SigningServiceResult,
    input: SignableInput,
  ): Promise<TestResult>;
}
