import {
  ApplicationChecker,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  isVersionAtLeast,
  resolveContactsVersionRequirements,
} from "@api/model/ContactsVersionRequirements";

import { ContactsApplicationResolver } from "./ContactsApplicationResolver";

/** The running app's identity, read freshly from the device. */
export type RunningApp = {
  readonly name: string;
  readonly version: string;
};

/**
 * Session-aware Contacts support check, for internal consumption by Contacts
 * `DeviceAction`s. Resolves the given running app against the static
 * requirements table:
 * - the device model must be supported;
 * - the running app must be known to Contacts and meet its minimum version;
 * - the device OS must meet its minimum version (a dimension `ApplicationChecker`
 *   does not cover, so it is checked separately here).
 *
 * The app `name` and `version` are supplied by the caller so they can come from
 * a fresh `WaitForAppAndVersion` result rather than the (potentially stale)
 * device session state; the model and OS come from the session state, which
 * does not change under the caller's feet the way the running app can.
 *
 * @param internalApi - the DeviceAction's internal API for the current session.
 * @param app - the running app's fresh name and version.
 */
export function isContactsSupportedForSession(
  internalApi: InternalApi,
  app: RunningApp,
): boolean {
  const deviceState = internalApi.getDeviceSessionState();
  const requirement = resolveContactsVersionRequirements(
    deviceState.deviceModelId,
  );
  if (!requirement.supported) return false;

  const minAppVersion = requirement.minAppVersion[app.name];
  if (minAppVersion === undefined) return false;

  const appCompatible = new ApplicationChecker(
    deviceState,
    { version: app.version },
    new ContactsApplicationResolver(),
  )
    .withMinVersionInclusive(minAppVersion)
    .check();
  if (!appCompatible) return false;

  const osVersion =
    "firmwareVersion" in deviceState
      ? deviceState.firmwareVersion?.os
      : undefined;
  if (osVersion === undefined) return false;

  return isVersionAtLeast(osVersion, requirement.minOsVersion);
}
