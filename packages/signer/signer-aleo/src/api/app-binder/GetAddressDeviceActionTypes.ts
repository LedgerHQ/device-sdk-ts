import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAddressCommandResponse } from "@internal/app-binder/command/GetAddressCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput =
  SendCommandInAppDAOutput<GetAddressCommandResponse>;

export type GetAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

export type GetAddressDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;
