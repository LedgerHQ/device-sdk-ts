import {
  type AppConfig,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "@internal/app-binder/constants";

const DEFAULT_VERSION = "0.0.1";

export class TronApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, _appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const currentApp = deviceState.currentApp;
    if (currentApp?.name !== APP_NAME) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    return { isCompatible: true, version: currentApp.version };
  }
}
