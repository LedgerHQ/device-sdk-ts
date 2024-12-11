import {
  type ExecuteDeviceActionReturnType,
  type SendCommandInAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetPublicKeyCommandResponse } from "@api/app-binder/GetPublicKeyCommandTypes";
import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";

type GetPublicKeyDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetPublicKeyDAOutput =
  SendCommandInAppDAOutput<GetPublicKeyCommandResponse>;
export type GetPublicKeyDAError = SendCommandInAppDAError<NearAppErrorCodes>;
export type GetPublicKeyDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetPublicKeyDAUserInteractionRequired>;

export type GetPublicKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetPublicKeyDAOutput,
  GetPublicKeyDAError,
  GetPublicKeyDAIntermediateValue
>;
