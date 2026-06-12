// Typed-only in M3 (the method is stubbed in DefaultContactsService);
// fully wired in M4.
import { type ExecuteDeviceActionReturnType } from "@api/device-action/DeviceAction";
import { type DeviceActionState } from "@api/device-action/model/DeviceActionState";
import { type UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import {
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
} from "@api/device-action/os/OpenAppDeviceAction/types";

import { type EditExternalAddressLabelResult } from "@api/contacts/model/EditExternalAddressLabelArgs";

export type EditExternalAddressLabelDAOutput = EditExternalAddressLabelResult;

export type EditExternalAddressLabelDAError = OpenAppDAError;

type EditExternalAddressLabelDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type EditExternalAddressLabelDAIntermediateValue = {
  requiredUserInteraction: EditExternalAddressLabelDARequiredInteraction;
};

export type EditExternalAddressLabelDAState = DeviceActionState<
  EditExternalAddressLabelDAOutput,
  EditExternalAddressLabelDAError,
  EditExternalAddressLabelDAIntermediateValue
>;

export type EditExternalAddressLabelDAReturnType = ExecuteDeviceActionReturnType<
  EditExternalAddressLabelDAOutput,
  EditExternalAddressLabelDAError,
  EditExternalAddressLabelDAIntermediateValue
>;
