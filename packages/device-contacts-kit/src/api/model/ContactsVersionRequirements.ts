import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { coerce, gte, valid } from "semver";

/**
 * Version requirements for a device model on which Contacts (Address Book)
 * operations are supported.
 *
 * Contacts has two independent version axes:
 * - `minOsVersion` gates OS-owned operations (e.g. renaming a contact from the
 *   device dashboard), which are served by the device OS.
 * - `minAppVersion` gates app-owned operations (registering / editing external
 *   addresses and Ledger accounts), which are served by the embedded app. It is
 *   keyed by app name because the required version differs per app; v1 ships
 *   Ethereum only.
 */
export type ContactsModelSupport = {
  readonly supported: true;
  readonly minOsVersion: string;
  readonly minAppVersion: Readonly<Record<string, string>>;
};

/** Marks a device model on which Contacts is not supported at all. */
export type ContactsModelUnsupported = {
  readonly supported: false;
};

export type ContactsModelRequirement =
  | ContactsModelSupport
  | ContactsModelUnsupported;

/**
 * The full, static Contacts version-requirement table, keyed by device model.
 * Serializable plain data with no runtime dependencies, so hosts (e.g. Ledger
 * Wallet) can import and consume it directly when composing their own
 * app-readiness checks, without duplicating the values.
 */
export type ContactsVersionRequirements = Readonly<
  Record<DeviceModelId, ContactsModelRequirement>
>;

/** The name of the Ethereum embedded app (the only app supported in v1). */
export const ETHEREUM_APP_NAME = "Ethereum";

const UNSUPPORTED: ContactsModelUnsupported = { supported: false };

// TODO(DSDK-1376): replace these placeholder versions with the real minimums
// confirmed by the firmware and Ethereum-app owners. The shape and consumers
// are final; only the version strings below are provisional.
const MIN_OS_VERSION_STAX = "1.5.0";
const MIN_OS_VERSION_FLEX = "1.2.0";
const MIN_OS_VERSION_APEX = "0.9.0";
const MIN_ETHEREUM_APP_VERSION = "1.15.0";

/**
 * Contacts APDUs are supported only on the touchscreen device models (Stax,
 * Flex, Apex). The Nano models do not support Contacts at all.
 */
export const CONTACTS_VERSION_REQUIREMENTS: ContactsVersionRequirements = {
  [DeviceModelId.NANO_S]: UNSUPPORTED,
  [DeviceModelId.NANO_SP]: UNSUPPORTED,
  [DeviceModelId.NANO_X]: UNSUPPORTED,
  [DeviceModelId.STAX]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_STAX,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
  },
  [DeviceModelId.FLEX]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_FLEX,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
  },
  [DeviceModelId.APEX]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_APEX,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
  },
};

/**
 * Resolve the Contacts version requirements for a device model — i.e. the
 * minimum supported OS and app versions, or that the model is unsupported.
 */
export function resolveContactsVersionRequirements(
  deviceModelId: DeviceModelId,
): ContactsModelRequirement {
  return CONTACTS_VERSION_REQUIREMENTS[deviceModelId];
}

/**
 * Whether `actual` is greater than or equal to `minimum`, comparing as semver.
 * Tolerant of non-strict version strings (coerces where possible) and returns
 * `false` (i.e. requirement not met) when either version cannot be parsed, so
 * an unknown version never passes a check.
 */
export function isVersionAtLeast(actual: string, minimum: string): boolean {
  const a = valid(actual) ?? valid(coerce(actual));
  const b = valid(minimum) ?? valid(coerce(minimum));
  if (a === null || b === null) return false;
  return gte(a, b);
}

/** Inputs for {@link isContactsSupported}. */
export type ContactsSupportQuery = {
  readonly deviceModelId: DeviceModelId;
  /** The device OS (firmware) version. */
  readonly osVersion: string;
  /** The name of the currently running embedded app. */
  readonly appName: string;
  /** The version of the currently running embedded app. */
  readonly appVersion: string;
};

/**
 * Whether Contacts app-owned operations are supported for the given device
 * model, OS version, and running app — checking the model is supported, the OS
 * meets its minimum, the app is known to Contacts, and the app meets its
 * minimum.
 *
 * Pure and dependency-light: hosts can call this directly, or read
 * {@link CONTACTS_VERSION_REQUIREMENTS} to build their own checks.
 */
export function isContactsSupported({
  deviceModelId,
  osVersion,
  appName,
  appVersion,
}: ContactsSupportQuery): boolean {
  const requirement = resolveContactsVersionRequirements(deviceModelId);
  if (!requirement.supported) return false;
  if (!isVersionAtLeast(osVersion, requirement.minOsVersion)) return false;

  const minAppVersion = requirement.minAppVersion[appName];
  if (minAppVersion === undefined) return false;
  return isVersionAtLeast(appVersion, minAppVersion);
}
