import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAOutput,
  type ExecuteDeviceActionReturnType,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SuiAddress } from "@api/model/SuiAddress";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput = CallTaskInAppDAOutput<SuiAddress>;
export type GetAddressDAError = CallTaskInAppDAError<SuiAppErrorCodes>;
export type GetAddressDAIntermediateValue =
  CallTaskInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;
