import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type SignPersonalMessageDAOutput = Signature;

export type SignPersonalMessageDAError =
  | OpenAppDAError
  | CommandErrorResult<TronAppErrorCodes>["error"];

type SignPersonalMessageDARequiredInteraction =
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
