import { type ExecuteDeviceActionReturnType } from "@ledgerhq/device-management-kit";

import {
  type SigningOperationsDAError,
  type SigningOperationsDAInput,
  type SigningOperationsDAIntermediateValue,
} from "@api/app-binder/SigningOperationsDeviceActionTypes";
import { type Signature } from "@api/model/Signature";

export type SignBasicClearSignDAInput = SigningOperationsDAInput;

export type SignBasicClearSignDAError = SigningOperationsDAError;

export type SignBasicClearSignDAIntermediateValue =
  SigningOperationsDAIntermediateValue;

export type SignBasicClearSignDAOutput = Signature;

export type SignBasicClearSignDAInternalState = {
  readonly error: SignBasicClearSignDAError | null;
  readonly signature: Signature | null;
  readonly zeroedTransaction: Uint8Array | null;
  readonly previewFallback: boolean;
  readonly transactionToSign: Uint8Array | null;
};

export type SignBasicClearSignDAReturnType = ExecuteDeviceActionReturnType<
  SignBasicClearSignDAOutput,
  SignBasicClearSignDAError,
  SignBasicClearSignDAIntermediateValue
>;
