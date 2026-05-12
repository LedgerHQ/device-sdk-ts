import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignNestedCallCommandResponse } from "@internal/app-binder/command/SignNestedCallCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

export type SignNestedCallDAOutput = SignNestedCallCommandResponse;

export type SignNestedCallDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

type SignNestedCallDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.None;

export type SignNestedCallDAIntermediateValue = {
  requiredUserInteraction: SignNestedCallDARequiredInteraction;
};

export type SignNestedCallDAReturnType = ExecuteDeviceActionReturnType<
  SignNestedCallDAOutput,
  SignNestedCallDAError,
  SignNestedCallDAIntermediateValue
>;
