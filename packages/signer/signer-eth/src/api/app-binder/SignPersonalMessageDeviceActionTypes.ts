import {
  type CallTaskInAppDAError,
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type SignPersonalMessageDAOutput = Signature;

export type SignPersonalMessageTaskError =
  CommandErrorResult<EthErrorCodes>["error"];
export type SignPersonalMessageDAError =
  CallTaskInAppDAError<SignPersonalMessageTaskError>;

export type SignPersonalMessageDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignPersonalMessage;

export type SignPersonalMessageDAIntermediateValue = {
  requiredUserInteraction: SignPersonalMessageDARequiredInteraction;
};

export type SignPersonalMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignPersonalMessageDAOutput,
  SignPersonalMessageDAError,
  SignPersonalMessageDAIntermediateValue
>;
