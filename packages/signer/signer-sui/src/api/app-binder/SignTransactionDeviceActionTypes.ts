import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAOutput,
  type ExecuteDeviceActionReturnType,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SuiSignature } from "@api/model/SuiSignature";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";

export type SignTransactionDAOutput = CallTaskInAppDAOutput<SuiSignature>;
export type SignTransactionDAError = CallTaskInAppDAError<SuiAppErrorCodes>;
export type SignTransactionDAIntermediateValue =
  CallTaskInAppDAIntermediateValue<UserInteractionRequired.SignTransaction>;

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
