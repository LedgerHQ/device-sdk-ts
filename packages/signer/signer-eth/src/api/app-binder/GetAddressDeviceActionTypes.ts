import {
  type CallTaskInAppDAError,
  type CallTaskInAppDAIntermediateValue,
  type CallTaskInAppDAOutput,
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetAddressCommandResponse } from "@api/app-binder/GetAddressCommandTypes";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

type GetAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetAddressDAOutput =
  CallTaskInAppDAOutput<GetAddressCommandResponse>;
export type GetAddressTaskError = CommandErrorResult<EthErrorCodes>["error"];
export type GetAddressDAError = CallTaskInAppDAError<GetAddressTaskError>;
export type GetAddressDAIntermediateValue =
  CallTaskInAppDAIntermediateValue<GetAddressDAUserInteractionRequired>;

export type GetAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetAddressDAOutput,
  GetAddressDAError,
  GetAddressDAIntermediateValue
>;
