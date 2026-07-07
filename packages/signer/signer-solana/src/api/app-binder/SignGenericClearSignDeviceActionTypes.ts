import { type ExecuteDeviceActionReturnType } from "@ledgerhq/device-management-kit";

import {
  type SignClearSignDAError,
  type SignClearSignDAInput,
  type SignClearSignDAIntermediateValue,
} from "@api/app-binder/SignClearSignDeviceActionTypes";
import { type Signature } from "@api/model/Signature";

export type SignGenericClearSignDAInput = SignClearSignDAInput;

export type SignGenericClearSignDAError = SignClearSignDAError;

export type SignGenericClearSignDAIntermediateValue =
  SignClearSignDAIntermediateValue;

/**
 * Terminal sign for an already-prepared generic clear-sign session. It runs the
 * prompt then, on approval, refreshes the blockhash and delayed-signs (0x09):
 * - `Right(Signature)` — approved and signed.
 * - `Right("degraded")` — the prompt failed for a non-cancel reason; the caller
 *   should fall back to the legacy basic path.
 * - `Left(error)` — the user cancelled or signing failed; surface it.
 */
export type SignGenericClearSignDAOutput = Signature | "degraded";

export type SignGenericClearSignDAInternalState = {
  readonly error: SignGenericClearSignDAError | null;
  readonly signature: Signature | null;
  readonly degraded: boolean;
  readonly transactionToSign: Uint8Array | null;
};

export type SignGenericClearSignDAReturnType = ExecuteDeviceActionReturnType<
  SignGenericClearSignDAOutput,
  SignGenericClearSignDAError,
  SignGenericClearSignDAIntermediateValue
>;
