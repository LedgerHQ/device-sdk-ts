import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type RegisterExternalAddressResult } from "@api/model/RegisterExternalAddressArgs";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type RegisterExternalAddressDAOutput = RegisterExternalAddressResult;

export type RegisterExternalAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

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
