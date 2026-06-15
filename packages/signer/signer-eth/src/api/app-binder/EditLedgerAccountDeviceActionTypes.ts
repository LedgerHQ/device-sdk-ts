import {
  type CommandErrorResult,
  type ContactsErrorCodes,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type EditLedgerAccountArgs,
  type EditLedgerAccountResult,
} from "@api/model/EditLedgerAccountArgs";

export type EditLedgerAccountDAInput = EditLedgerAccountArgs;

export type EditLedgerAccountDAOutput = EditLedgerAccountResult;

export type EditLedgerAccountDAError =
  | OpenAppDAError
  | CommandErrorResult<ContactsErrorCodes>["error"];

type EditLedgerAccountDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type EditLedgerAccountDAIntermediateValue = {
  requiredUserInteraction: EditLedgerAccountDARequiredInteraction;
};

export type EditLedgerAccountDAState = DeviceActionState<
  EditLedgerAccountDAOutput,
  EditLedgerAccountDAError,
  EditLedgerAccountDAIntermediateValue
>;

export type EditLedgerAccountDAReturnType = ExecuteDeviceActionReturnType<
  EditLedgerAccountDAOutput,
  EditLedgerAccountDAError,
  EditLedgerAccountDAIntermediateValue
>;
