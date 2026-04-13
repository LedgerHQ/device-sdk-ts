import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignTransferCommandResponse } from "@internal/app-binder/command/SignTransferCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

export type SignTransactionDAOutput =
  SendCommandInAppDAOutput<SignTransferCommandResponse>;
export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<ConcordiumErrorCodes>["error"];

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
