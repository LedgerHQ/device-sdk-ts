import { type ExecuteDeviceActionReturnType } from "@api/device-action/DeviceAction";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
} from "@api/device-action/os/OpenAppDeviceAction/types";

import { type RenameContactResult } from "@api/contacts/model/RenameContactArgs";

export type RenameContactDAOutput = RenameContactResult;

export type RenameContactDAError = OpenAppDAError;

type RenameContactDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RenameContactDAIntermediateValue = {
  requiredUserInteraction: RenameContactDARequiredInteraction;
};

export type RenameContactDAState = DeviceActionState<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;

export type RenameContactDAReturnType = ExecuteDeviceActionReturnType<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;
