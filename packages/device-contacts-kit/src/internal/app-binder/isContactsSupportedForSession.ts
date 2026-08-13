import {
  type AppConfig,
  ApplicationChecker,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  isVersionAtLeast,
  resolveContactsVersionRequirements,
} from "@api/model/ContactsVersionRequirements";

import { ContactsApplicationResolver } from "./ContactsApplicationResolver";

/**
 * Session-aware Contacts support check, for internal consumption by Contacts
 * `DeviceAction`s. Reads the current device session and resolves it against the
 * static requirements table:
 * - the device model must be supported;
 * - the running app must be known to Contacts and meet its minimum version —
 *   validated with DMK's {@link ApplicationChecker} so the version comes from
 *   the authoritative `GetAppConfiguration` result;
 * - the device OS must meet its minimum version (a dimension `ApplicationChecker`
 *   does not cover, so it is checked separately here).
 *
 * @param internalApi - the DeviceAction's internal API for the current session.
 * @param appConfig - the running app's configuration (must include its version).
 */
export function isContactsSupportedForSession(
  internalApi: InternalApi,
  appConfig: AppConfig,
): boolean {
  const deviceState = internalApi.getDeviceSessionState();
  const requirement = resolveContactsVersionRequirements(
    deviceState.deviceModelId,
  );
  if (!requirement.supported) return false;

  const appName =
    "currentApp" in deviceState ? deviceState.currentApp?.name : undefined;
  if (appName === undefined) return false;

  const minAppVersion = requirement.minAppVersion[appName];
  if (minAppVersion === undefined) return false;

  const appCompatible = new ApplicationChecker(
    deviceState,
    appConfig,
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
