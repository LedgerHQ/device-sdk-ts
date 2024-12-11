import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
import { type SignMessageTaskArgs } from "@internal/app-binder/task/SignMessageTask";

export type SignMessageDAOutput = Uint8Array;

export type SignMessageDAInput = {
  args: SignMessageTaskArgs;
};

export type SignMessageDAError =
  | OpenAppDAError
  | CommandErrorResult<NearAppErrorCodes>["error"];

type SignMessageDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignMessageDAIntermediateValue = {
  requiredUserInteraction: SignMessageDARequiredInteraction;
};

export type SignMessageDAState = DeviceActionState<
  SignMessageDAOutput,
  SignMessageDAError,
  SignMessageDAIntermediateValue
>;

export type SignMessageDAInternalState = {
  readonly error: SignMessageDAError | null;
  readonly signature: Uint8Array | null;
};

export type SignMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignMessageDAOutput,
  SignMessageDAError,
  SignMessageDAIntermediateValue
>;
