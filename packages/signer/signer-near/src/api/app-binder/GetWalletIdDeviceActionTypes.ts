import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetWalletIdCommandResponse } from "@api/app-binder/GetWalletIdCommandTypes";

type GetWalletIdDAUserInteractionRequired = UserInteractionRequired.None;

export type GetWalletIdDAOutput =
  SendCommandInAppDAOutput<GetWalletIdCommandResponse>;
export type GetWalletIdDAError = SendCommandInAppDAError<never>; // TODO: add specific command errors when error handling for commands is properly implemented
export type GetWalletIdDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetWalletIdDAUserInteractionRequired>;

export type GetWalletIdDAReturnType = ExecuteDeviceActionReturnType<
  GetWalletIdDAOutput,
  GetWalletIdDAError,
  GetWalletIdDAIntermediateValue
>;
