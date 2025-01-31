import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";

export type SignMessageDAOutput = Signature;

export type SignMessageDAError =
  | OpenAppDAError
  | CommandErrorResult<BtcErrorCodes>["error"];

type SignMessageDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignPersonalMessage;

export type SignMessageDAIntermediateValue = {
  requiredUserInteraction: SignMessageDARequiredInteraction;
};

export type SignMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignMessageDAOutput,
  SignMessageDAError,
  SignMessageDAIntermediateValue
>;
