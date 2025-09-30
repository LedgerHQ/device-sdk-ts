import { TransactionInput } from "../models/TransactionInput";
import { TypedDataInput } from "../models/TypedDataInput";

/**
 * Status of a signing test result
 */
export type TestStatus =
    | "error"
    | "clear_signed"
    | "blind_signed"
    | "partially_clear_signed";

/**
 * Common interface for test results with status
 */
export interface TestResult {
    readonly input: TransactionInput | TypedDataInput;
    readonly status: TestStatus;
    readonly timestamp: string;
    readonly errorMessage?: string;
}
