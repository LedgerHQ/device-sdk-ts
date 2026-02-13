import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetViewKeyCommandResponse } from "@internal/app-binder/command/GetViewKeyCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

type GetViewKeyDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetViewKeyDAOutput =
  SendCommandInAppDAOutput<GetViewKeyCommandResponse>;

export type GetViewKeyDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

export type GetViewKeyDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetViewKeyDAUserInteractionRequired>;

export type GetViewKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetViewKeyDAOutput,
  GetViewKeyDAError,
  GetViewKeyDAIntermediateValue
>;
