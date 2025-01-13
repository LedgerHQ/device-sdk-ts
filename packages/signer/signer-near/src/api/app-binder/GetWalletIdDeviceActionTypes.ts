import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetWalletIdCommandResponse } from "@api/app-binder/GetWalletIdCommandTypes";
import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";

type GetWalletIdDAUserInteractionRequired =
  UserInteractionRequired.VerifyAddress;

export type GetWalletIdDAOutput =
  SendCommandInAppDAOutput<GetWalletIdCommandResponse>;
export type GetWalletIdDAError = SendCommandInAppDAError<NearAppErrorCodes>;
export type GetWalletIdDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetWalletIdDAUserInteractionRequired>;

export type GetWalletIdDAReturnType = ExecuteDeviceActionReturnType<
  GetWalletIdDAOutput,
  GetWalletIdDAError,
  GetWalletIdDAIntermediateValue
>;
