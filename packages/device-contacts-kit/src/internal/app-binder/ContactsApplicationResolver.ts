import {
  type AppConfig,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

const DEFAULT_VERSION = "0.0.0";

/**
 * Resolves the running-app version for Contacts, for use with DMK's
 * `ApplicationChecker`. Which app names and versions are actually required is
 * decided by the static Contacts requirements table, so this resolver only
 * surfaces the authoritative app version (from `GetAppConfiguration`) and
 * rejects sessions where no app is running.
 */
export class ContactsApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const appName = deviceState.currentApp?.name;
    if (!appName) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    return { isCompatible: true, version: appConfig.version };
  }
}
