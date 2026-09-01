import {
  ApplicationChecker,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  type ContactsModelRequirement,
  type ContactsModelSupport,
  isVersionAtLeast,
  resolveContactsVersionRequirements,
} from "@api/model/ContactsVersionRequirements";

import { ContactsApplicationResolver } from "./ContactsApplicationResolver";

/** The running app's identity, read freshly from the device. */
export type RunningApp = {
  readonly name: string;
  readonly version: string;
};

/** Narrows a resolved requirement to the case where Contacts is supported at all on this device model. */
function isContactsModelSupported(
  requirement: ContactsModelRequirement,
): requirement is ContactsModelSupport {
  return requirement.supported;
}

/**
 * OS-only Contacts support check, for internal consumption by dashboard
 * `DeviceAction`s (e.g. Rename Contact, EDIT CONTACT NAME). Dashboard operations
 * are served by the device OS, not the embedded app, so only two dimensions
 * apply:
 * - the device model must be supported;
 * - the device OS must meet its minimum version.
 *
 * The running-app dimension is intentionally skipped: on the dashboard there is
 * no embedded app to gate on (the running "app" is BOLOS).
 *
 * @param internalApi - the DeviceAction's internal API for the current session.
 */
export function isContactsOsSupportedForSession(
  internalApi: InternalApi,
): boolean {
  const deviceState = internalApi.getDeviceSessionState();
  const requirement = resolveContactsVersionRequirements(
    deviceState.deviceModelId,
  );
  if (!isContactsModelSupported(requirement)) return false;

  const osVersion =
    "firmwareVersion" in deviceState
      ? deviceState.firmwareVersion?.os
      : undefined;
  if (osVersion === undefined) return false;

  return isVersionAtLeast(osVersion, requirement.minOsVersion);
}

/**
 * Session-aware Contacts support check, for internal consumption by app-owned
 * Contacts `DeviceAction`s (registering / editing external addresses). These
 * operations are served by the embedded app, not the device OS, so only two
 * dimensions apply:
 * - the device model must be supported;
 * - the running app must be known to Contacts and meet its minimum version.
 *
 * The app `name` and `version` are supplied by the caller so they can come from
 * a fresh `WaitForAppAndVersion` result rather than the (potentially stale)
 * device session state; the model comes from the session state, which does
 * not change under the caller's feet the way the running app can.
 *
 * @param internalApi - the DeviceAction's internal API for the current session.
 * @param app - the running app's fresh name and version.
 */
export function isContactsAppVersionSupportedForSession(
  internalApi: InternalApi,
  app: RunningApp,
): boolean {
  const deviceState = internalApi.getDeviceSessionState();
  const requirement = resolveContactsVersionRequirements(
    deviceState.deviceModelId,
  );
  if (!isContactsModelSupported(requirement)) return false;

  const minAppVersion = requirement.minAppVersion[app.name];
  if (minAppVersion === undefined) return false;

  return new ApplicationChecker(
    deviceState,
    { version: app.version },
    new ContactsApplicationResolver(),
  )
    .withMinVersionInclusive(minAppVersion)
    .check();
}
