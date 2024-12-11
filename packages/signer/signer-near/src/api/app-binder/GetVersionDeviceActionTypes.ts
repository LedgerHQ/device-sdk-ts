import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetVersionCommandResponse } from "@api/app-binder/GetVersionCommandTypes";
import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";

type GetVersionDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetVersionDAOutput =
  SendCommandInAppDAOutput<GetVersionCommandResponse>;
export type GetVersionDAError = SendCommandInAppDAError<NearAppErrorCodes>;
export type GetVersionDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetVersionDAUserInteractionRequired>;

export type GetVersionDAReturnType = ExecuteDeviceActionReturnType<
  GetVersionDAOutput,
  GetVersionDAError,
  GetVersionDAIntermediateValue
>;
