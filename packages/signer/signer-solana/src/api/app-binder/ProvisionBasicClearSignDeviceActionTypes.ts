import {
  type ContextModule,
  type SolanaTransactionContextResultSuccess,
} from "@ledgerhq/context-module";

import {
  type SignTransactionDAError,
  type SignTransactionDASimpleIntermediateValue,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

/**
 * Best-effort outcome: this machine only streams legacy SPL / token descriptors
 * to the device, it never signs. Any failure is swallowed (the caller signs
 * blind), so the output is always `Right`.
 */
export type ProvisionBasicClearSignDAOutput = void;

export type ProvisionBasicClearSignDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
  readonly appConfig: AppConfiguration;
  readonly rpcUrl?: string;
  readonly resolutionContext?: TransactionResolutionContext;
};

export type ProvisionBasicClearSignDAError = SignTransactionDAError;

export type ProvisionBasicClearSignDAIntermediateValue =
  SignTransactionDASimpleIntermediateValue;

export type ProvisionBasicClearSignDAInternalState = {
  readonly inspectorResult: TxInspectorResult | null;
  readonly solanaTransactionContext: SolanaTransactionContextResultSuccess | null;
};
