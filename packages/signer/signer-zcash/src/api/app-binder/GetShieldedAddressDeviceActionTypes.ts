import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

type GetShieldedAddressDAUserInteractionRequired =
  | UserInteractionRequired.None
  | UserInteractionRequired.VerifyAddress;

export type GetShieldedAddressDAOutput = {
  readonly address: string;
};

export type GetShieldedAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<ZcashErrorCodes>["error"];

type GetShieldedAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | GetShieldedAddressDAUserInteractionRequired;

export type GetShieldedAddressDAIntermediateValue = {
  readonly requiredUserInteraction: GetShieldedAddressDARequiredInteraction;
};

export type GetShieldedAddressDAReturnType = ExecuteDeviceActionReturnType<
  GetShieldedAddressDAOutput,
  GetShieldedAddressDAError,
  GetShieldedAddressDAIntermediateValue
>;
