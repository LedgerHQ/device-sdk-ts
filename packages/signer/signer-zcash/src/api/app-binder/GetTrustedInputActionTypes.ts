import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetTrustedInputCommandResponse } from "@internal/app-binder/command/GetTrustedInputCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

type GetTrustedInputDAUserInteractionRequired = UserInteractionRequired.None;

export type GetTrustedInputDAOutput =
  SendCommandInAppDAOutput<GetTrustedInputCommandResponse>;

export type GetTrustedInputDAError =
  | OpenAppDAError
  | CommandErrorResult<ZcashErrorCodes>["error"];

export type GetTrustedInputDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetTrustedInputDAUserInteractionRequired>;

export type GetTrustedInputDAReturnType = ExecuteDeviceActionReturnType<
  GetTrustedInputDAOutput,
  GetTrustedInputDAError,
  GetTrustedInputDAIntermediateValue
>;
