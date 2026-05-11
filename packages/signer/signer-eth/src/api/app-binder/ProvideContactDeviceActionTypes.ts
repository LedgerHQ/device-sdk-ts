import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ProvideContactResult } from "@api/model/ProvideContactArgs";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type ProvideContactDAOutput = ProvideContactResult;

export type ProvideContactDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

// Silent op — no user-facing interaction past OpenApp. `None` is the
// resting state once the app is open and the framed APDU is in flight.
type ProvideContactDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.None;

export type ProvideContactDAIntermediateValue = {
  requiredUserInteraction: ProvideContactDARequiredInteraction;
};

export type ProvideContactDAState = DeviceActionState<
  ProvideContactDAOutput,
  ProvideContactDAError,
  ProvideContactDAIntermediateValue
>;

export type ProvideContactDAReturnType = ExecuteDeviceActionReturnType<
  ProvideContactDAOutput,
  ProvideContactDAError,
  ProvideContactDAIntermediateValue
>;
