import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetVersionCommandResponse } from "@internal/app-binder/command/GetVersionCommand";
import { type IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";

type GetVersionDAUserInteractionRequired = UserInteractionRequired.None;

export type GetVersionDAOutput =
  SendCommandInAppDAOutput<GetVersionCommandResponse>;

export type GetVersionDAError =
  | OpenAppDAError
  | CommandErrorResult<IcpErrorCodes>["error"];

export type GetVersionDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetVersionDAUserInteractionRequired>;

export type GetVersionDAReturnType = ExecuteDeviceActionReturnType<
  GetVersionDAOutput,
  GetVersionDAError,
  GetVersionDAIntermediateValue
>;
