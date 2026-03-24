import {
  type AppConfig,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "./constants";

const DEFAULT_VERSION = "0.0.1";

export const SOLANA_APP_SPL_MIN_VERSION = "1.9.2";

export class SolanaApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const currentApp = deviceState.currentApp;
    const appName = currentApp?.name;

    if (!appName) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const version =
      appName === APP_NAME ? currentApp.version : appConfig.version;

    return { isCompatible: true, version };
  }
}
