import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignTransactionCommandResponse } from "@internal/app-binder/command/SignTransactionCommand";
import { type HederaErrorCodes } from "@internal/app-binder/command/utils/hederaApplicationErrors";

type SignTransactionDAUserInteractionRequired =
  UserInteractionRequired.SignTransaction;

export type SignTransactionDAOutput =
  SendCommandInAppDAOutput<SignTransactionCommandResponse>;

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<HederaErrorCodes>["error"];

export type SignTransactionDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<SignTransactionDAUserInteractionRequired>;

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
