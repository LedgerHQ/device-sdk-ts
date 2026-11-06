import { type ContactInput } from "@root/src/domain/models/ContactInput";
import { type SafeAddressInput } from "@root/src/domain/models/SafeAddressInput";
import { type SignableInput } from "@root/src/domain/models/SignableInput";

/**
 * Status of a signing test result
 */
export type TestStatus =
  | "error"
  | "clear_signed"
  | "blind_signed"
  | "partially_clear_signed";

/**
 * Common type for test results with status
 */
export type TestResult = {
  readonly input: SignableInput | ContactInput | SafeAddressInput;
  readonly status: TestStatus;
  readonly timestamp: string;
  readonly errorMessage?: string;
  readonly hash?: string;
};
