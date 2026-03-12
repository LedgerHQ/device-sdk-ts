import {
  type AppConfig,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

const DEFAULT_VERSION = "0.0.1";
export const SOLANA_MIN_SPL_VERSION = "1.9.2";
export const SOLANA_MIN_DELAYED_SIGNING_VERSION = "1.14.0";

export class SolanaApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, _appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const currentApp = deviceState.currentApp;
    const appName = currentApp?.name;

    if (!appName || appName !== "Solana") {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    return { isCompatible: true, version: currentApp.version };
  }
}
