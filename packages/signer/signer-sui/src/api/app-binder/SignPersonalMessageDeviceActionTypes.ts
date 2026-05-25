import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAOutput,
  type ExecuteDeviceActionReturnType,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SuiSignature } from "@api/model/SuiSignature";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";

export type SignPersonalMessageDAOutput = CallTaskInAppDAOutput<SuiSignature>;
export type SignPersonalMessageDAError =
  CallTaskInAppDAError<SuiAppErrorCodes>;
export type SignPersonalMessageDAIntermediateValue =
  CallTaskInAppDAIntermediateValue<UserInteractionRequired.SignPersonalMessage>;

export type SignPersonalMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignPersonalMessageDAOutput,
  SignPersonalMessageDAError,
  SignPersonalMessageDAIntermediateValue
>;
