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
  readonly isBlockhashRefreshNeeded?: boolean;
  readonly serializedForTxCheck?: Uint8Array;
};

/**
 * Best-effort: the machine provisions the tx-check descriptor but never
 * signs; any failure is swallowed, so the output is always `Right`.
 */
export type ProvisionTransactionCheckDAOutput = void;

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

export type ProvisionTransactionCheckDASimpleIntermediateValue =
  SignTransactionDASimpleIntermediateValue;
