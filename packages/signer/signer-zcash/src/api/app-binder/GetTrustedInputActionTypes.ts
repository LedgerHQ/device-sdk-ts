import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetTrustedInputCommandResponse } from "@internal/app-binder/command/GetTrustedInputCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

type GetTrustedInputDAUserInteractionRequired = UserInteractionRequired.None;

export type GetTrustedInputDAOutput = GetTrustedInputCommandResponse;

export type GetTrustedInputDAError =
  | OpenAppDAError
  | CommandErrorResult<ZcashErrorCodes>["error"];

type GetTrustedInputDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | GetTrustedInputDAUserInteractionRequired;

export type GetTrustedInputDAIntermediateValue = {
  requiredUserInteraction: GetTrustedInputDARequiredInteraction;
};

export type GetTrustedInputDAReturnType = ExecuteDeviceActionReturnType<
  GetTrustedInputDAOutput,
  GetTrustedInputDAError,
  GetTrustedInputDAIntermediateValue
>;
