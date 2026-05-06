import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { type GetFullViewingKeyTaskData } from "@internal/app-binder/task/GetFullViewingKeyTask";

type GetFullViewingKeyDAUserInteractionRequired = UserInteractionRequired.None;

export type GetFullViewingKeyDAOutput = GetFullViewingKeyTaskData;

export type GetFullViewingKeyDAError =
  | OpenAppDAError
  | CommandErrorResult<ZcashErrorCodes>["error"];

type GetFullViewingKeyDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | GetFullViewingKeyDAUserInteractionRequired;

export type GetFullViewingKeyDAIntermediateValue = {
  readonly requiredUserInteraction: GetFullViewingKeyDARequiredInteraction;
};

export type GetFullViewingKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetFullViewingKeyDAOutput,
  GetFullViewingKeyDAError,
  GetFullViewingKeyDAIntermediateValue
>;
