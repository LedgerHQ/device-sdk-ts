import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignFeeIntentCommandResponse } from "@internal/app-binder/command/SignFeeIntentCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

export type SignFeeIntentDAOutput = SignFeeIntentCommandResponse;

export type SignFeeIntentDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

type SignFeeIntentDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignFeeIntentDAIntermediateValue = {
  requiredUserInteraction: SignFeeIntentDARequiredInteraction;
};

export type SignFeeIntentDAReturnType = ExecuteDeviceActionReturnType<
  SignFeeIntentDAOutput,
  SignFeeIntentDAError,
  SignFeeIntentDAIntermediateValue
>;
