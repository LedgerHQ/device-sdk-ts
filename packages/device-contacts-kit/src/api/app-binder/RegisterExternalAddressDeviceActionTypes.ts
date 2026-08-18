import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type RegisterExternalAddressInput,
  type RegisterExternalAddressOutput,
} from "@api/model/RegisterExternalAddress";
import {
  type ContactsErrorCodes,
  type ContactsVersionRequirementError,
} from "@internal/app-binder/model/contactsErrors";
import { type ContactsValidationError } from "@internal/app-binder/model/contactsValidation";

/** Machine input: the public input plus the injected embedded-app name. */
export type RegisterExternalAddressDAInput = RegisterExternalAddressInput & {
  readonly appName: string;
};

export type RegisterExternalAddressDAOutput = RegisterExternalAddressOutput;

export type RegisterExternalAddressDAError =
  | OpenAppDAError
  | ContactsValidationError
  | ContactsVersionRequirementError
  | CommandErrorResult<ContactsErrorCodes>["error"];

export type RegisterExternalAddressDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.RegisterWallet;

export type RegisterExternalAddressDAIntermediateValue = {
  readonly requiredUserInteraction: RegisterExternalAddressDARequiredInteraction;
};

export type RegisterExternalAddressDAState = DeviceActionState<
  RegisterExternalAddressDAOutput,
  RegisterExternalAddressDAError,
  RegisterExternalAddressDAIntermediateValue
>;

export type RegisterExternalAddressDAInternalState = {
  readonly error: RegisterExternalAddressDAError | null;
  /** The running app read freshly by WaitForAppAndVersion, for the version guard. */
  readonly appAndVersion: {
    readonly name: string;
    readonly version: string;
  } | null;
  readonly proofs: {
    readonly groupHandle: Uint8Array;
    readonly hmacProof: Uint8Array;
    readonly hmacRest: Uint8Array;
  } | null;
};

export type RegisterExternalAddressDAReturnType = ExecuteDeviceActionReturnType<
  RegisterExternalAddressDAOutput,
  RegisterExternalAddressDAError,
  RegisterExternalAddressDAIntermediateValue
>;
