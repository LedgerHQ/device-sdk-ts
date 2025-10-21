import {
  type ClearSignContextSuccess,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export enum VerifySafeAddressDAStep {
  OPEN_APP = "signer.eth.steps.openApp",
  BUILD_CONTEXTS = "signer.eth.steps.buildContexts",
  PROVIDE_CONTEXTS = "signer.eth.steps.provideContexts",
  VERIFY_SAFE_ADDRESS = "signer.eth.steps.verifySafeAddress",
}

export type VerifySafeAddressDAOutput = void;

export type VerifySafeAddressDAInput = {
  readonly safeContractAddress: string;
  readonly contextModule: ContextModule;
  readonly options: SafeAddressOptions;
};

export type VerifySafeAddressDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type VerifySafeAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.VerifySafeAddress;

export type VerifySafeAddressDAIntermediateValue = {
  requiredUserInteraction: VerifySafeAddressDARequiredInteraction;
  step: VerifySafeAddressDAStep;
};

export type VerifySafeAddressDAState = DeviceActionState<
  VerifySafeAddressDAOutput,
  VerifySafeAddressDAError,
  VerifySafeAddressDAIntermediateValue
>;

export type VerifySafeAddressDAInternalState = {
  readonly error: VerifySafeAddressDAError | null;
  readonly contexts: ClearSignContextSuccess[];
};

export type VerifySafeAddressDAReturnType = ExecuteDeviceActionReturnType<
  VerifySafeAddressDAOutput,
  VerifySafeAddressDAError,
  VerifySafeAddressDAIntermediateValue
>;
