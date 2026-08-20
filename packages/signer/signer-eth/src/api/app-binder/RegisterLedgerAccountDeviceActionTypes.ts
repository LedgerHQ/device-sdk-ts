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

export type RegisterLedgerAccountDAInput = RegisterLedgerAccountArgs;

export type RegisterLedgerAccountDAOutput = RegisterLedgerAccountResult;

export type RegisterLedgerAccountDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type RegisterLedgerAccountDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RegisterLedgerAccountDAIntermediateValue = {
  requiredUserInteraction: RegisterLedgerAccountDARequiredInteraction;
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
