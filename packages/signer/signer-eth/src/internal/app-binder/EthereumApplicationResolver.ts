import {
  type AppConfig,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

const DEFAULT_VERSION = "0.0.1";

export class EthereumApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const currentApp = deviceState.currentApp;
    const appName = currentApp?.name;

    if (!appName) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    if (appName === "Exchange") {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const version =
      appName === "Ethereum" ? currentApp.version : appConfig.version;

    return { isCompatible: true, version };
  }
}
