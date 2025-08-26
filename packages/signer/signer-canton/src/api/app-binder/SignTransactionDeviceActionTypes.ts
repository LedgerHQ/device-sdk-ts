import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type CantonAppErrorCodes } from "@internal/app-binder/command/utils/CantonApplicationErrors";

type SignTransactionDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.SignTransaction;

export type SignTransactionDAOutput = SendCommandInAppDAOutput<Signature>;
export type SignTransactionDAError = SendCommandInAppDAError<CantonAppErrorCodes>;
export type SignTransactionDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<SignTransactionDAUserInteractionRequired>;

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
