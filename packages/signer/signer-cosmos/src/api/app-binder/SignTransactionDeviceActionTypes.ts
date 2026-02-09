import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignTransactionCommandResponse } from "@internal/app-binder/command/SignTransactionCommand";
import { type CosmosErrorCodes } from "@internal/app-binder/command/utils/CosmosApplicationErrors";

export type SignTransactionDAOutput =
  SendCommandInAppDAOutput<SignTransactionCommandResponse>;
export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<CosmosErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
