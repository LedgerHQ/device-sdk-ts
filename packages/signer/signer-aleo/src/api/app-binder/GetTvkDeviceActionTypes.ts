import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetTvkCommandResponse } from "@internal/app-binder/command/GetTvkCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

type GetTvkDAUserInteractionRequired = UserInteractionRequired.None;

export type GetTvkDAOutput = SendCommandInAppDAOutput<GetTvkCommandResponse>;

export type GetTvkDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

export type GetTvkDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetTvkDAUserInteractionRequired>;

export type GetTvkDAReturnType = ExecuteDeviceActionReturnType<
  GetTvkDAOutput,
  GetTvkDAError,
  GetTvkDAIntermediateValue
>;
