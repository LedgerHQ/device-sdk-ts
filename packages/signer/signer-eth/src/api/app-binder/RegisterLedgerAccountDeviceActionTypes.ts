import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type RegisterLedgerAccountArgs,
  type RegisterLedgerAccountResult,
} from "@api/model/RegisterLedgerAccountArgs";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export enum RegisterLedgerAccountDAStep {
  OPEN_APP = "signer.eth.steps.openApp",
  REGISTER_LEDGER_ACCOUNT = "signer.eth.steps.registerLedgerAccount",
  GET_ADDRESS = "signer.eth.steps.getAddress",
}

export type RegisterLedgerAccountDAInput = RegisterLedgerAccountArgs;

export type RegisterLedgerAccountDAOutput = RegisterLedgerAccountResult;

export type RegisterLedgerAccountDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type RegisterLedgerAccountDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet
  | UserInteractionRequired.None;

export type RegisterLedgerAccountDAIntermediateValue = {
  requiredUserInteraction: RegisterLedgerAccountDARequiredInteraction;
  step: RegisterLedgerAccountDAStep;
};

export type RegisterLedgerAccountDAInternalState = {
  readonly error: RegisterLedgerAccountDAError | null;
  readonly hmacProofHex: string | null;
  readonly addressHex: string | null;
};

export type RegisterLedgerAccountDAState = DeviceActionState<
  RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAError,
  RegisterLedgerAccountDAIntermediateValue
>;

export type RegisterLedgerAccountDAReturnType = ExecuteDeviceActionReturnType<
  RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAError,
  RegisterLedgerAccountDAIntermediateValue
>;
