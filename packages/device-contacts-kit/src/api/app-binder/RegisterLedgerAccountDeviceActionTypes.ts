import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type RegisterLedgerAccountInput,
  type RegisterLedgerAccountOutput,
} from "@api/model/RegisterLedgerAccount";
import {
  type ContactsErrorCodes,
  type ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";
import { type ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

/** Machine input: the public input plus the injected embedded-app name. */
export type RegisterLedgerAccountDAInput = RegisterLedgerAccountInput & {
  readonly appName: string;
};

export type RegisterLedgerAccountDAOutput = RegisterLedgerAccountOutput;

export type RegisterLedgerAccountDAError =
  | OpenAppDAError
  | ContactsValidationError
  | ContactsVersionRequirementError
  | CommandErrorResult<ContactsErrorCodes>["error"];

export type RegisterLedgerAccountDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RegisterLedgerAccountDAIntermediateValue = {
  readonly requiredUserInteraction: RegisterLedgerAccountDARequiredInteraction;
};

export type RegisterLedgerAccountDAState = DeviceActionState<
  RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAError,
  RegisterLedgerAccountDAIntermediateValue
>;

export type RegisterLedgerAccountDAInternalState = {
  readonly error: RegisterLedgerAccountDAError | null;
  /** The running app read freshly by WaitForAppAndVersion, for the version guard. */
  readonly appAndVersion: {
    readonly name: string;
    readonly version: string;
  } | null;
  readonly proof: Uint8Array | null;
};

export type RegisterLedgerAccountDAReturnType = ExecuteDeviceActionReturnType<
  RegisterLedgerAccountDAOutput,
  RegisterLedgerAccountDAError,
  RegisterLedgerAccountDAIntermediateValue
>;
