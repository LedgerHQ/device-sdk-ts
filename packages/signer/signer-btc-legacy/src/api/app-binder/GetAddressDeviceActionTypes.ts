import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAddressCommandResponse } from "@internal/app-binder/command/GetAddressCommand";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput =
  SendCommandInAppDAOutput<GetAddressCommandResponse>;

export type GetAddressDAError<ErrorCodes extends string> =
  | OpenAppDAError
  | CommandErrorResult<ErrorCodes>["error"];

export type GetAddressDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType<ErrorCodes extends string> =
  ExecuteDeviceActionReturnType<
    GetAddressDAOutput,
    GetAddressDAError<ErrorCodes>,
    GetAddressDAIntermediateValue
  >;
