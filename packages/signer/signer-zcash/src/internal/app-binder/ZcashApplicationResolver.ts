import {
  type AppConfig,
  ApplicationChecker,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type InternalApi,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "@internal/app-binder/constants";

/** Reported when the session state carries no version for the Zcash app. */
const UNKNOWN_VERSION = "0.0.0";

/** The app version is read from the session state, not from an app configuration. */
const NO_APP_CONFIG: AppConfig = { version: "" };

/**
 * First app version shipping v6 (ZIP-229) support. Earlier ones answer 6a80 to the
 * first GET_TRUSTED_INPUT APDU. The 3.0.x line never gains v6, so the floor sits on
 * the line that does rather than on an unreleased 3.0.x.
 */
export const MIN_APP_VERSION_FOR_V6_TRANSACTIONS = "3.8.0";

export class ZcashApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, _appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: UNKNOWN_VERSION };
    }

    const currentApp = deviceState.currentApp;

    // Any other app, "Exchange" included, leaves the answer to the device.
    if (currentApp?.name !== APP_NAME) {
      return { isCompatible: false, version: UNKNOWN_VERSION };
    }

    return { isCompatible: true, version: currentApp.version };
  }
}

/**
 * The version of the connected app when that version is known not to support v6
 * transactions, `undefined` otherwise.
 *
 * Only a version the session state reports for the Zcash app is judged. Without
 * one — no app opened yet, or a version the comparison cannot read, as a
 * development build may carry — the device stays the authority and answers on its
 * own, exactly as it did before this check existed.
 */
export function appVersionWithoutV6Support(
  internalApi: InternalApi,
): string | undefined {
  try {
    const deviceState = internalApi.getDeviceSessionState();
    const resolver = new ZcashApplicationResolver();
    const { isCompatible, version } = resolver.resolve(
      deviceState,
      NO_APP_CONFIG,
    );

    if (!isCompatible) {
      return undefined;
    }

    const supportsV6 = new ApplicationChecker(
      deviceState,
      NO_APP_CONFIG,
      resolver,
    )
      .withMinVersionInclusive(MIN_APP_VERSION_FOR_V6_TRANSACTIONS)
      .check();

    return supportsV6 ? undefined : version;
  } catch {
    return undefined;
  }
}
