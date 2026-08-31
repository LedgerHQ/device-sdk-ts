import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type EditExternalAddressIdentifierInput,
  type EditExternalAddressIdentifierOutput,
} from "@api/model/EditExternalAddressIdentifier";
import {
  type ContactsErrorCodes,
  type ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";
import { type ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

/** Machine input: the public input plus the injected embedded-app name. */
export type EditExternalAddressIdentifierDAInput =
  EditExternalAddressIdentifierInput & {
    readonly appName: string;
  };

export type EditExternalAddressIdentifierDAOutput =
  EditExternalAddressIdentifierOutput;

export type EditExternalAddressIdentifierDAError =
  | OpenAppDAError
  | ContactsValidationError
  | ContactsVersionRequirementError
  | CommandErrorResult<ContactsErrorCodes>["error"];

export type EditExternalAddressIdentifierDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type EditExternalAddressIdentifierDAIntermediateValue = {
  readonly requiredUserInteraction: EditExternalAddressIdentifierDARequiredInteraction;
};

export type EditExternalAddressIdentifierDAState = DeviceActionState<
  EditExternalAddressIdentifierDAOutput,
  EditExternalAddressIdentifierDAError,
  EditExternalAddressIdentifierDAIntermediateValue
>;

export type EditExternalAddressIdentifierDAInternalState = {
  readonly error: EditExternalAddressIdentifierDAError | null;
  /** The running app read freshly by WaitForAppAndVersion, for the version guard. */
  readonly appAndVersion: {
    readonly name: string;
    readonly version: string;
  } | null;
  /** The rotated address-level proof returned by the device on success. */
  readonly hmacRest: Uint8Array | null;
};

export type EditExternalAddressIdentifierDAReturnType =
  ExecuteDeviceActionReturnType<
    EditExternalAddressIdentifierDAOutput,
    EditExternalAddressIdentifierDAError,
    EditExternalAddressIdentifierDAIntermediateValue
  >;
