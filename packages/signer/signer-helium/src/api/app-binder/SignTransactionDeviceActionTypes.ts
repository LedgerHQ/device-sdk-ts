import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type HeliumErrorCodes } from "@internal/app-binder/command/utils/heliumAppErrors";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<HeliumErrorCodes>["error"];

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
