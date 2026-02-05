import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAppConfigCommandResponse } from "@internal/app-binder/command/GetAppConfigCommand";
import { type NearErrorCodes } from "@internal/app-binder/command/utils/nearApplicationErrors";

type GetAppConfigDAUserInteractionRequired =
  | UserInteractionRequired.None;

export type GetAppConfigDAOutput =
  SendCommandInAppDAOutput<GetAppConfigCommandResponse>;

export type GetAppConfigDAError =
  | OpenAppDAError
  | CommandErrorResult<NearErrorCodes>["error"];

export type GetAppConfigDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAppConfigDAUserInteractionRequired>;

export type GetAppConfigDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigDAOutput,
  GetAppConfigDAError,
  GetAppConfigDAIntermediateValue
>;
