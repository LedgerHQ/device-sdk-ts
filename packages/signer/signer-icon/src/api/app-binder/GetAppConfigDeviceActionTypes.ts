import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAppConfigCommandResponse } from "@internal/app-binder/command/GetAppConfigCommand";
import { type IconErrorCodes } from "@internal/app-binder/command/utils/iconAppErrors";

type GetAppConfigDAUserInteractionRequired =
  | UserInteractionRequired.None;

export type GetAppConfigDAOutput =
  SendCommandInAppDAOutput<GetAppConfigCommandResponse>;

export type GetAppConfigDAError =
  | OpenAppDAError
  | CommandErrorResult<IconErrorCodes>["error"];

export type GetAppConfigDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAppConfigDAUserInteractionRequired>;

export type GetAppConfigDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigDAOutput,
  GetAppConfigDAError,
  GetAppConfigDAIntermediateValue
>;
