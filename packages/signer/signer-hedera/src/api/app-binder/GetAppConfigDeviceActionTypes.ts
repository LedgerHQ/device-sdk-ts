import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type AppConfig } from "@api/model/AppConfig";
import { type HederaErrorCodes } from "@internal/app-binder/command/utils/hederaApplicationErrors";

type GetAppConfigDAUserInteractionRequired = UserInteractionRequired.None;

export type GetAppConfigDAOutput = SendCommandInAppDAOutput<AppConfig>;

export type GetAppConfigDAError =
  | OpenAppDAError
  | CommandErrorResult<HederaErrorCodes>["error"];

export type GetAppConfigDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAppConfigDAUserInteractionRequired>;

export type GetAppConfigDAReturnType = ExecuteDeviceActionReturnType<
  GetAppConfigDAOutput,
  GetAppConfigDAError,
  GetAppConfigDAIntermediateValue
>;
