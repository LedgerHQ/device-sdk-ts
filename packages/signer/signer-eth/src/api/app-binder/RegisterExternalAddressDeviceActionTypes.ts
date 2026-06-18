import {
  type CommandErrorResult,
  type ContactsErrorCodes,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type RegisterExternalAddressResult } from "@api/model/RegisterExternalAddressArgs";

export type RegisterExternalAddressDAOutput = RegisterExternalAddressResult;

export type RegisterExternalAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<ContactsErrorCodes>["error"];

type RegisterExternalAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RegisterExternalAddressDAIntermediateValue = {
  requiredUserInteraction: RegisterExternalAddressDARequiredInteraction;
};

export type RegisterExternalAddressDAState = DeviceActionState<
  RegisterExternalAddressDAOutput,
  RegisterExternalAddressDAError,
  RegisterExternalAddressDAIntermediateValue
>;

export type RegisterExternalAddressDAReturnType = ExecuteDeviceActionReturnType<
  RegisterExternalAddressDAOutput,
  RegisterExternalAddressDAError,
  RegisterExternalAddressDAIntermediateValue
>;
