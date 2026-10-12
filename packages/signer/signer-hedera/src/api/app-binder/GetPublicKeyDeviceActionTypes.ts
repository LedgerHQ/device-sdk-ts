import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetPublicKeyCommandResponse } from "@internal/app-binder/command/GetPublicKeyCommand";
import { type HederaErrorCodes } from "@internal/app-binder/command/utils/hederaApplicationErrors";

type GetPublicKeyDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetPublicKeyDAOutput =
  SendCommandInAppDAOutput<GetPublicKeyCommandResponse>;

export type GetPublicKeyDAError =
  | OpenAppDAError
  | CommandErrorResult<HederaErrorCodes>["error"];

export type GetPublicKeyDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetPublicKeyDAUserInteractionRequired>;

export type GetPublicKeyDAReturnType = ExecuteDeviceActionReturnType<
  GetPublicKeyDAOutput,
  GetPublicKeyDAError,
  GetPublicKeyDAIntermediateValue
>;
