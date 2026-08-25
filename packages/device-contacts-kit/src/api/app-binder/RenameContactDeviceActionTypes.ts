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
  readonly proof: {
    readonly hmacProof: Uint8Array;
  } | null;
};

export type RenameContactDAReturnType = ExecuteDeviceActionReturnType<
  RenameContactDAOutput,
  RenameContactDAError,
  RenameContactDAIntermediateValue
>;
