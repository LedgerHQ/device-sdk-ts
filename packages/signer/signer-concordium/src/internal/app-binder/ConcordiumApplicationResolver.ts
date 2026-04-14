import {
  type AppConfig,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "@internal/app-binder/constants";

/** Last app-concordium release before GET_APP_VERSION (0x40) was added. */
export const CONCORDIUM_APP_VERSION_FLOOR = "5.3.4";

export class ConcordiumApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, _appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return {
        isCompatible: false,
        version: CONCORDIUM_APP_VERSION_FLOOR,
      };
    }

    const currentApp = deviceState.currentApp;
    const appName = currentApp?.name;

    if (!appName || appName !== APP_NAME) {
      return {
        isCompatible: false,
        version: CONCORDIUM_APP_VERSION_FLOOR,
      };
    }

    return { isCompatible: true, version: currentApp.version };
  }
}
