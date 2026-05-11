import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type ProvideLedgerAccountResult } from "@api/model/ProvideLedgerAccountArgs";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type ProvideLedgerAccountDAOutput = ProvideLedgerAccountResult;

export type ProvideLedgerAccountDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

// Silent op — see ProvideContactDeviceActionTypes for the reasoning.
type ProvideLedgerAccountDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.None;

export type ProvideLedgerAccountDAIntermediateValue = {
  requiredUserInteraction: ProvideLedgerAccountDARequiredInteraction;
};

export type ProvideLedgerAccountDAState = DeviceActionState<
  ProvideLedgerAccountDAOutput,
  ProvideLedgerAccountDAError,
  ProvideLedgerAccountDAIntermediateValue
>;

export type ProvideLedgerAccountDAReturnType = ExecuteDeviceActionReturnType<
  ProvideLedgerAccountDAOutput,
  ProvideLedgerAccountDAError,
  ProvideLedgerAccountDAIntermediateValue
>;
