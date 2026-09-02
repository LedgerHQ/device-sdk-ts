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

const MIN_OS_VERSION_STAX = "1.11.0";
const MIN_OS_VERSION_FLEX = "1.7.0";
const MIN_OS_VERSION_APEX = "1.2.0";
const MIN_OS_VERSION_NANO_X = "2.8.0";
const MIN_OS_VERSION_NANO_SP = "1.7.0";

const MIN_ETHEREUM_APP_VERSION = "1.23.0";

/**
 * Contacts APDUs are supported on the touchscreen device models (Stax, Flex,
 * Apex) and on Nano X / Nano SP. Nano S does not support Contacts at all.
 */
export const CONTACTS_VERSION_REQUIREMENTS: ContactsVersionRequirements = {
  [DeviceModelId.NANO_S]: UNSUPPORTED,
  [DeviceModelId.NANO_SP]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_NANO_SP,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
  },
  [DeviceModelId.NANO_X]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_NANO_X,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
  },
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
 * Tolerant of non-strict version strings and prerelease/build tags (coerces
 * both sides, which drops them) so a release candidate such as `1.7.0-rc2`
 * counts as meeting a `1.7.0` minimum. Returns `false` (i.e. requirement not
 * met) when either version cannot be parsed, so an unknown version never
 * passes a check.
 */
export function isVersionAtLeast(actual: string, minimum: string): boolean {
  const a = valid(coerce(actual));
  const b = valid(coerce(minimum));
  if (a === null || b === null) return false;
  return gte(a, b);
}
