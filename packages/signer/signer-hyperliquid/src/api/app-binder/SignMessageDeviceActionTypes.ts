import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAIntermediateValue,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignMessageCommandResponse } from "@internal/app-binder/command/SignMessageCommand";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";

type SignMessageDAUserInteractionRequired =
  | UserInteractionRequired.None | UserInteractionRequired.SignPersonalMessage;

export type SignMessageDAOutput =
  SendCommandInAppDAOutput<SignMessageCommandResponse>;

export type SignMessageDAError =
  | OpenAppDAError
  | CommandErrorResult<HyperliquidErrorCodes>["error"];

export type SignMessageDAIntermediateValue =
  SendCommandInAppDAIntermediateValue<SignMessageDAUserInteractionRequired>;

export type SignMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignMessageDAOutput,
  SignMessageDAError,
  SignMessageDAIntermediateValue
>;
