import { type ContextModule } from "@ledgerhq/context-module";

import {
  type SignTransactionDAIntermediateValue,
  type SignTransactionDASimpleIntermediateValue,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";

export type ProvisionTransactionCheckDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
  // Supplied at invoke time (depends on parent's runtime state)
  readonly appConfig?: AppConfiguration;
  readonly serializedForTxCheck?: Uint8Array;
};

/**
 * Best-effort: the machine provisions the tx-check descriptor but never
 * signs; any failure is swallowed, so the output is always `Right`.
 * `transactionChecksEnabled` is the state after the opt-in prompt (if any),
 * so the parent can re-provision later without prompting again.
 */
export type ProvisionTransactionCheckDAOutput = {
  readonly transactionChecksEnabled: boolean;
};

export type ProvisionTransactionCheckDAError = never;

/**
 * Emits the full union so the opt-in-result step's `result` field is
 * preserved when the parent forwards child snapshots.
 */
export type ProvisionTransactionCheckDAIntermediateValue =
  SignTransactionDAIntermediateValue;

export type ProvisionTransactionCheckDAInternalState = {
  // Starts from input.appConfig; updated with transactionChecksEnabled after opt-in.
  readonly appConfig: AppConfiguration | null;
};

/** @deprecated Unused; will be removed in the next major version. */
export type ProvisionTransactionCheckDASimpleIntermediateValue =
  SignTransactionDASimpleIntermediateValue;
