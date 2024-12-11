import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
import { type SignDelegateTaskArgs } from "@internal/app-binder/task/SignDelegateTask";

export type SignDelegateDAOutput = Uint8Array;

export type SignDelegateDAInput = {
  args: SignDelegateTaskArgs;
};

export type SignDelegateDAError =
  | OpenAppDAError
  | CommandErrorResult<NearAppErrorCodes>["error"];

type SignDelegateDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignDelegateDAIntermediateValue = {
  requiredUserInteraction: SignDelegateDARequiredInteraction;
};

export type SignDelegateDAState = DeviceActionState<
  SignDelegateDAOutput,
  SignDelegateDAError,
  SignDelegateDAIntermediateValue
>;

export type SignDelegateDAInternalState = {
  readonly error: SignDelegateDAError | null;
  readonly signature: Uint8Array | null;
  readonly publicKey: string | null;
};

export type SignDelegateDAReturnType = ExecuteDeviceActionReturnType<
  SignDelegateDAOutput,
  SignDelegateDAError,
  SignDelegateDAIntermediateValue
>;
