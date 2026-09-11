import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { coerce, gte, lt, valid } from "semver";

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
  /**
   * TEMPORARY (DSDK-1481) — the first OS build for this model that no longer
   * wants the `DERIVATION_PATH` (tag 0x69) on EDIT CONTACT NAME. Rename is
   * served by the OS, and OS builds *below* this version still require the path
   * (omitting it yields 0x686A), while this build and later reject it
   * (0x6A80). So the path is sent only when the device OS is below this
   * cutoff. Absent means the model never wanted the path (send nothing — the
   * GA end-state). Delete this field, its constants, and
   * {@link renameRequiresDerivationPath} once no in-the-field OS predates the
   * cutoff.
   */
  readonly renameDerivationPathRequiredBelowOsVersion?: string;
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

// TEMPORARY (DSDK-1481) — per-model cutoff below which the OS still requires the
// EDIT CONTACT NAME derivation path. Each model's Address-Book-introducing OS
// release shipped an rc2 that mandates the path (0x686A without it) and an rc3
// that drops it (0x6A80 with it), so the cutoff is that release's `-rc3`. Only
// Flex is hardware-confirmed (rc2 on a real device); the others follow the same
// rc2/rc3 split per firmware — revise here if firmware says a model differs.
const RENAME_PATH_CUTOFF_STAX = `${MIN_OS_VERSION_STAX}-rc3`;
const RENAME_PATH_CUTOFF_FLEX = `${MIN_OS_VERSION_FLEX}-rc3`;
const RENAME_PATH_CUTOFF_APEX = `${MIN_OS_VERSION_APEX}-rc3`;
const RENAME_PATH_CUTOFF_NANO_X = `${MIN_OS_VERSION_NANO_X}-rc3`;
const RENAME_PATH_CUTOFF_NANO_SP = `${MIN_OS_VERSION_NANO_SP}-rc3`;

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
    renameDerivationPathRequiredBelowOsVersion: RENAME_PATH_CUTOFF_NANO_SP,
  },
  [DeviceModelId.NANO_X]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_NANO_X,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
    renameDerivationPathRequiredBelowOsVersion: RENAME_PATH_CUTOFF_NANO_X,
  },
  [DeviceModelId.STAX]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_STAX,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
    renameDerivationPathRequiredBelowOsVersion: RENAME_PATH_CUTOFF_STAX,
  },
  [DeviceModelId.FLEX]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_FLEX,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
    renameDerivationPathRequiredBelowOsVersion: RENAME_PATH_CUTOFF_FLEX,
  },
  [DeviceModelId.APEX]: {
    supported: true,
    minOsVersion: MIN_OS_VERSION_APEX,
    minAppVersion: { [ETHEREUM_APP_NAME]: MIN_ETHEREUM_APP_VERSION },
    renameDerivationPathRequiredBelowOsVersion: RENAME_PATH_CUTOFF_APEX,
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

/**
 * Whether `actual` is strictly less than `boundary`, comparing as semver with
 * prerelease precedence preserved — unlike {@link isVersionAtLeast}, neither
 * side is coerced, so `1.7.0-rc2` sorts *below* `1.7.0-rc3` (and both below the
 * `1.7.0` release). Used to tell release candidates apart for the DSDK-1481
 * derivation-path cutoff, which `isVersionAtLeast` cannot do (it drops the
 * `-rcN` tag). Requires strict semver on both sides; returns `false` when
 * either cannot be parsed, so an unknown version is treated as *not* below the
 * boundary (i.e. the newer/GA payload shape).
 */
export function isVersionBelow(actual: string, boundary: string): boolean {
  const a = valid(actual);
  const b = valid(boundary);
  if (a === null || b === null) return false;
  return lt(a, b);
}

/**
 * TEMPORARY (DSDK-1481) — whether the EDIT CONTACT NAME (rename) payload must
 * carry the `DERIVATION_PATH` (tag 0x69) for a device on `osVersion`. True only
 * when the model is supported, declares a
 * {@link ContactsModelSupport.renameDerivationPathRequiredBelowOsVersion}
 * cutoff, and the fresh device OS version is strictly below that cutoff
 * (prerelease-aware). Callers pass the OS version read freshly from the device
 * (not the session state, which may be stale/absent on the dashboard path).
 */
export function renameRequiresDerivationPath(
  deviceModelId: DeviceModelId,
  osVersion: string,
): boolean {
  const requirement = CONTACTS_VERSION_REQUIREMENTS[deviceModelId];
  if (!requirement.supported) return false;
  const cutoff = requirement.renameDerivationPathRequiredBelowOsVersion;
  if (cutoff === undefined) return false;
  return isVersionBelow(osVersion, cutoff);
}
