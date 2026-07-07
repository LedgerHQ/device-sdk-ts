import {
  type ClearSignContext,
  type ContextModule,
} from "@ledgerhq/context-module";

import {
  type ClearSignMode,
  type SignTransactionDAError,
  type SignTransactionDASimpleIntermediateValue,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type ChallengeBoundRequirements } from "@internal/app-binder/task/BuildGenericClearSignContextTask";

/**
 * Outcome of the generic clear-sign preparation. This machine streams the
 * descriptors and validates the session but performs no UI and does not sign —
 * the prompt and terminal sign are run by
 * `SignGenericClearSignDeviceAction`.
 * - `"prepared"` — `BuildContext` + `ProvideContext` + `Finalize` succeeded; the
 *   session is ready for the prompt + terminal sign.
 * - `"degraded"` — no instruction recognised or a best-effort step (build /
 *   provide / finalize) failed; the caller should fall back to the legacy path.
 *
 * Every step is best-effort, so this machine never surfaces a user cancel (the
 * first user interaction lives downstream in the prompt).
 */
export type ProvisionGenericClearSignDAOutput = "prepared" | "degraded";

export type ProvisionGenericClearSignDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
};

export type ProvisionGenericClearSignDAError = SignTransactionDAError;

export type ProvisionGenericClearSignDAIntermediateValue =
  SignTransactionDASimpleIntermediateValue;

export type ProvisionGenericClearSignDAInternalState = {
  readonly error: ProvisionGenericClearSignDAError | null;
  readonly outcome: ProvisionGenericClearSignDAOutput | null;
  readonly mode: ClearSignMode | null;
  readonly poolContexts: ClearSignContext[] | null;
  readonly instructionInfoContexts: ClearSignContext[] | null;
  readonly challengeBoundRequirements: ChallengeBoundRequirements | null;
};
