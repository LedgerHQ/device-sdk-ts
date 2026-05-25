import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAOutput,
  type ExecuteDeviceActionReturnType,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SuiAppVersion } from "@api/model/SuiAppVersion";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";

export type GetVersionDAOutput = CallTaskInAppDAOutput<SuiAppVersion>;
export type GetVersionDAError = CallTaskInAppDAError<SuiAppErrorCodes>;
export type GetVersionDAIntermediateValue =
  CallTaskInAppDAIntermediateValue<UserInteractionRequired.None>;

export type GetVersionDAReturnType = ExecuteDeviceActionReturnType<
  GetVersionDAOutput,
  GetVersionDAError,
  GetVersionDAIntermediateValue
>;
