import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type EditExternalAddressResult } from "@api/model/EditExternalAddressArgs";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type EditExternalAddressDAOutput = EditExternalAddressResult;

export type EditExternalAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

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
