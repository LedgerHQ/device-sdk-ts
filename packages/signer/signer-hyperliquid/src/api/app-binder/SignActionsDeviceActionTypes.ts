import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";

export type SignActionsDAOutput = Signature;

export type SignActionsDAError =
  | OpenAppDAError
  | CommandErrorResult<HyperliquidErrorCodes>["error"];

type SignActionsDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignActionsDAIntermediateValue = {
  requiredUserInteraction: SignActionsDARequiredInteraction;
};

export type SignActionsDAReturnType = ExecuteDeviceActionReturnType<
  SignActionsDAOutput,
  SignActionsDAError,
  SignActionsDAIntermediateValue
>;
