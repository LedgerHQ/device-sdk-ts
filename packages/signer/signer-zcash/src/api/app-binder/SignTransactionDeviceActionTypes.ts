import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type HexaString,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

export type SignTransactionDAOutput = HexaString;

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<ZcashErrorCodes>["error"];

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
