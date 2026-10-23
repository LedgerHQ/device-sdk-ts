import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetExtendedPublicKeyTaskData } from "@internal/app-binder/task/GetExtendedPublicKeyTask";

export type GetExtendedPublicKeyDAOutput = GetExtendedPublicKeyTaskData;

export type GetExtendedPublicKeyDAError<ErrorCodes extends string> =
  | OpenAppDAError
  | CommandErrorResult<ErrorCodes>["error"];

export type GetExtendedPublicKeyDAIntermediateValue = {
  readonly requiredUserInteraction:
    | OpenAppDARequiredInteraction
    | UserInteractionRequired.None;
};

export type GetExtendedPublicKeyDAReturnType<ErrorCodes extends string> =
  ExecuteDeviceActionReturnType<
    GetExtendedPublicKeyDAOutput,
    GetExtendedPublicKeyDAError<ErrorCodes>,
    GetExtendedPublicKeyDAIntermediateValue
  >;
