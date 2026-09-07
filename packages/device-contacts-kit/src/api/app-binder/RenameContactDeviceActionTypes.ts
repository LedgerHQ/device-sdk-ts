import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type GoToDashboardDAError,
  type GoToDashboardDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type RenameContactInput,
  type RenameContactOutput,
} from "@api/model/RenameContact";
import {
  type ContactsErrorCodes,
  type ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";
import { type ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

/**
 * Rename is a dashboard operation, so the machine input is exactly the public
 * input — no embedded-app name is injected (the OS serves the command; there is
 * no app to open).
 */
export type RenameContactDAInput = RenameContactInput;

export type RenameContactDAOutput = RenameContactOutput;

export type RenameContactDAError =
  | GoToDashboardDAError
  | ContactsValidationError
  | ContactsVersionRequirementError
  // A `GetOsVersion` failure surfaces as the command error itself (not a
  // version-requirement error). `GetOsVersion` carries no Contacts-specific
  // error codes, so its error type is the bare command error.
  | CommandErrorResult["error"]
  | CommandErrorResult<ContactsErrorCodes>["error"];

export type RenameContactDARequiredInteraction =
  | GoToDashboardDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RenameContactDAIntermediateValue = {
  readonly requiredUserInteraction: RenameContactDARequiredInteraction;
};

export type RenameContactDAState = DeviceActionState<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;

export type RenameContactDAInternalState = {
  readonly error: RenameContactDAError | null;
  // The device OS version read freshly via `GetOsVersion` after reaching the
  // dashboard, fed to the version guard instead of the session state (whose
  // firmware version is often absent on this path).
  readonly osVersion: string | null;
  readonly proof: {
    readonly hmacProof: Uint8Array;
  } | null;
};

export type RenameContactDAReturnType = ExecuteDeviceActionReturnType<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;
