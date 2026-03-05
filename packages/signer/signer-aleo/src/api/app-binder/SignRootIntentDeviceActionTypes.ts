import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignRootIntentCommandResponse } from "@internal/app-binder/command/SignRootIntentCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

export type SignRootIntentDAOutput = SignRootIntentCommandResponse;

export type SignRootIntentDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

type SignRootIntentDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignRootIntentDAIntermediateValue = {
  requiredUserInteraction: SignRootIntentDARequiredInteraction;
};

export type SignRootIntentDAReturnType = ExecuteDeviceActionReturnType<
  SignRootIntentDAOutput,
  SignRootIntentDAError,
  SignRootIntentDAIntermediateValue
>;
