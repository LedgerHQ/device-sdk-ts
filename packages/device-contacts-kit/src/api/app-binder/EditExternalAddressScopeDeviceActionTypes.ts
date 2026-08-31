import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type EditExternalAddressScopeInput,
  type EditExternalAddressScopeOutput,
} from "@api/model/EditExternalAddressScope";
import {
  type ContactsErrorCodes,
  type ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";
import { type ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

/** Machine input: the public input plus the injected embedded-app name. */
export type EditExternalAddressScopeDAInput = EditExternalAddressScopeInput & {
  readonly appName: string;
};

export type EditExternalAddressScopeDAOutput = EditExternalAddressScopeOutput;

export type EditExternalAddressScopeDAError =
  | OpenAppDAError
  | ContactsValidationError
  | ContactsVersionRequirementError
  | CommandErrorResult<ContactsErrorCodes>["error"];

export type EditExternalAddressScopeDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type EditExternalAddressScopeDAIntermediateValue = {
  readonly requiredUserInteraction: EditExternalAddressScopeDARequiredInteraction;
};

export type EditExternalAddressScopeDAState = DeviceActionState<
  EditExternalAddressScopeDAOutput,
  EditExternalAddressScopeDAError,
  EditExternalAddressScopeDAIntermediateValue
>;

export type EditExternalAddressScopeDAInternalState = {
  readonly error: EditExternalAddressScopeDAError | null;
  /** The running app read freshly by WaitForAppAndVersion, for the version guard. */
  readonly appAndVersion: {
    readonly name: string;
    readonly version: string;
  } | null;
  /** The rotated address-level proof returned by the device on success. */
  readonly hmacRest: Uint8Array | null;
};

export type EditExternalAddressScopeDAReturnType =
  ExecuteDeviceActionReturnType<
    EditExternalAddressScopeDAOutput,
    EditExternalAddressScopeDAError,
    EditExternalAddressScopeDAIntermediateValue
  >;
