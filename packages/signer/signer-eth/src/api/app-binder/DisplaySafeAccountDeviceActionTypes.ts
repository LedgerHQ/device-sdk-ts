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

import { type SafeAccountOptions } from "@api/model/SafeAccountOptions";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export enum DisplaySafeAccountDAStep {
  OPEN_APP = "signer.eth.steps.openApp",
  BUILD_CONTEXTS = "signer.eth.steps.buildContexts",
  PROVIDE_CONTEXTS = "signer.eth.steps.provideContexts",
  VERIFY_SAFE_ACCOUNT = "signer.eth.steps.verifySafeAccount",
}

export type DisplaySafeAccountDAOutput = void;

export type DisplaySafeAccountDAInput = {
  readonly safeContractAddress: string;
  readonly contextModule: ContextModule;
  readonly options: SafeAccountOptions;
};

export type DisplaySafeAccountDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type DisplaySafeAccountDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.VerifySafeAccount;

export type DisplaySafeAccountDAIntermediateValue = {
  requiredUserInteraction: DisplaySafeAccountDARequiredInteraction;
  step: DisplaySafeAccountDAStep;
};

export type DisplaySafeAccountDAState = DeviceActionState<
  DisplaySafeAccountDAOutput,
  DisplaySafeAccountDAError,
  DisplaySafeAccountDAIntermediateValue
>;

export type DisplaySafeAccountDAInternalState = {
  readonly error: DisplaySafeAccountDAError | null;
  readonly contexts: ClearSignContextSuccess[];
};

export type DisplaySafeAccountDAReturnType = ExecuteDeviceActionReturnType<
  DisplaySafeAccountDAOutput,
  DisplaySafeAccountDAError,
  DisplaySafeAccountDAIntermediateValue
>;
