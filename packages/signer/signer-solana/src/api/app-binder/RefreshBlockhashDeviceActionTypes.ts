import {
  type ExecuteDeviceActionReturnType,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type SigningOperationsDAError,
  type SigningOperationsDAStateStep,
} from "@api/app-binder/SigningOperationsDeviceActionTypes";
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

/**
 * Best-effort blockhash refresh shared by the terminal signing machines:
 * fetch the latest blockhash and patch it into the transaction. Any failure
 * (or a missing source) degrades to the original transaction, so this child
 * never errors — its output is always the bytes to sign.
 */
export type RefreshBlockhashDAOutput = Uint8Array;

export type RefreshBlockhashDAInput = {
  readonly transaction: Uint8Array;
  readonly rpcUrl?: string;
  readonly fetchBlockhash?: () => Promise<Uint8Array>;
  readonly blockhashService?: BlockhashService;
};

export type RefreshBlockhashDAError = SigningOperationsDAError;

export type RefreshBlockhashDAIntermediateValue = {
  requiredUserInteraction: UserInteractionRequired.None;
  step: SigningOperationsDAStateStep;
};

export type RefreshBlockhashDAInternalState = {
  readonly freshBlockhash: Uint8Array | null;
  readonly patchedTransaction: Uint8Array | null;
};

export type RefreshBlockhashDAReturnType = ExecuteDeviceActionReturnType<
  RefreshBlockhashDAOutput,
  RefreshBlockhashDAError,
  RefreshBlockhashDAIntermediateValue
>;
