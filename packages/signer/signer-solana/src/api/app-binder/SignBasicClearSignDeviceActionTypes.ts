import { type ExecuteDeviceActionReturnType } from "@ledgerhq/device-management-kit";

import {
  type SignClearSignDAError,
  type SignClearSignDAInput,
  type SignClearSignDAIntermediateValue,
} from "@api/app-binder/SignClearSignDeviceActionTypes";
import { type Signature } from "@api/model/Signature";

export type SignBasicClearSignDAInput = SignClearSignDAInput;

export type SignBasicClearSignDAError = SignClearSignDAError;

export type SignBasicClearSignDAIntermediateValue =
  SignClearSignDAIntermediateValue;

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
