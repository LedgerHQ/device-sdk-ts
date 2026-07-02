import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignPcztTransactionResult } from "@api/model/PcztSignature";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

export type SignPcztTransactionDAOutput = SignPcztTransactionResult;

export type SignPcztTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<ZcashErrorCodes>["error"];

type SignPcztTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignPcztTransactionDAIntermediateValue = {
  requiredUserInteraction: SignPcztTransactionDARequiredInteraction;
};

export type SignPcztTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignPcztTransactionDAOutput,
  SignPcztTransactionDAError,
  SignPcztTransactionDAIntermediateValue
>;
