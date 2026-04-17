import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type LoadCertificateErrorCodes,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

export type VerifyAddressErrorCodes =
  | ConcordiumErrorCodes
  | LoadCertificateErrorCodes;

export type VerifyAddressDAOutput = true;
export type VerifyAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<VerifyAddressErrorCodes>["error"];

type VerifyAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.VerifyAddress;

export type VerifyAddressDAIntermediateValue = {
  requiredUserInteraction: VerifyAddressDARequiredInteraction;
};

export type VerifyAddressDAReturnType = ExecuteDeviceActionReturnType<
  VerifyAddressDAOutput,
  VerifyAddressDAError,
  VerifyAddressDAIntermediateValue
>;
