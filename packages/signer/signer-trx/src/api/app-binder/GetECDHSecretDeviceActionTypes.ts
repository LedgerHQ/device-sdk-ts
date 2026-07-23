import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetECDHSecretCommandResponse } from "@internal/app-binder/command/GetECDHSecretCommand";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

type GetECDHSecretDAUserInteractionRequired =
  UserInteractionRequired.SignTransaction;

export type GetECDHSecretDAOutput =
  SendCommandInAppDAOutput<GetECDHSecretCommandResponse>;

export type GetECDHSecretDAError =
  | OpenAppDAError
  | CommandErrorResult<TronAppErrorCodes>["error"];

export type GetECDHSecretDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<GetECDHSecretDAUserInteractionRequired>;

export type GetECDHSecretDAReturnType = ExecuteDeviceActionReturnType<
  GetECDHSecretDAOutput,
  GetECDHSecretDAError,
  GetECDHSecretDAIntermediateValue
>;
