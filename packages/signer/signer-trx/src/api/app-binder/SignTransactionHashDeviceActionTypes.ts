import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

type SignTransactionHashDAUserInteractionRequired =
  UserInteractionRequired.SignTransaction;

export type SignTransactionHashDAOutput = SendCommandInAppDAOutput<Signature>;

export type SignTransactionHashDAError =
  | OpenAppDAError
  | CommandErrorResult<TronAppErrorCodes>["error"];

export type SignTransactionHashDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<SignTransactionHashDAUserInteractionRequired>;

export type SignTransactionHashDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionHashDAOutput,
  SignTransactionHashDAError,
  SignTransactionHashDAIntermediateValue
>;
