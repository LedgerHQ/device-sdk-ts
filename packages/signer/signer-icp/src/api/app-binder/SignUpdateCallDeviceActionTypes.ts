import {
  type CallTaskInAppDAOutput,
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type UpdateCallSignature } from "@api/model/UpdateCallSignature";
import { type IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";

export type SignUpdateCallDAOutput = CallTaskInAppDAOutput<UpdateCallSignature>;
export type SignUpdateCallDAError =
  | OpenAppDAError
  | CommandErrorResult<IcpErrorCodes>["error"];

type SignUpdateCallDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignUpdateCallDAIntermediateValue = {
  requiredUserInteraction: SignUpdateCallDARequiredInteraction;
};

export type SignUpdateCallDAReturnType = ExecuteDeviceActionReturnType<
  SignUpdateCallDAOutput,
  SignUpdateCallDAError,
  SignUpdateCallDAIntermediateValue
>;
