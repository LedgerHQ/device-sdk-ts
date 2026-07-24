import {
  type CommandErrorResult,
  type ContactsErrorCodes,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type EditExternalAddressResult } from "@api/model/EditExternalAddressArgs";

export type EditExternalAddressDAOutput = EditExternalAddressResult;

export type EditExternalAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<ContactsErrorCodes>["error"];

type EditExternalAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type EditExternalAddressDAIntermediateValue = {
  requiredUserInteraction: EditExternalAddressDARequiredInteraction;
};

export type EditExternalAddressDAState = DeviceActionState<
  EditExternalAddressDAOutput,
  EditExternalAddressDAError,
  EditExternalAddressDAIntermediateValue
>;

export type EditExternalAddressDAReturnType = ExecuteDeviceActionReturnType<
  EditExternalAddressDAOutput,
  EditExternalAddressDAError,
  EditExternalAddressDAIntermediateValue
>;
