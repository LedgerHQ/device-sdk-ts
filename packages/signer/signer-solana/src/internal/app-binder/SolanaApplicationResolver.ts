import {
  type AppConfig,
  type ApplicationResolver,
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "./constants";

const DEFAULT_VERSION = "0.0.1";
export const SOLANA_MIN_SPL_VERSION = "1.9.2";
export const SOLANA_MIN_DELAYED_SIGNING_VERSION = "1.14.0";
export const SOLANA_MIN_WEB3_CHECKS_VERSION = "1.15.0";

export const SOLANA_FEATURES = {
  spl: {
    minVersion: SOLANA_MIN_SPL_VERSION,
    excludedModels: [DeviceModelId.NANO_S],
    excludedApps: [] as string[],
  },
  web3Checks: {
    minVersion: SOLANA_MIN_WEB3_CHECKS_VERSION,
    excludedModels: [
      DeviceModelId.NANO_S,
      DeviceModelId.NANO_SP,
      DeviceModelId.NANO_X,
    ],
    excludedApps: ["Exchange"],
  },
  delayedSigning: {
    minVersion: SOLANA_MIN_DELAYED_SIGNING_VERSION,
    excludedModels: [] as DeviceModelId[],
    excludedApps: [] as string[],
  },
} as const;

export class SolanaApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, appConfig: AppConfig): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const appName = deviceState.currentApp?.name;

    if (!appName || (appName !== APP_NAME && appName !== "Exchange")) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    // appConfig.version is authoritative: it comes from GetAppConfiguration
    // executed against the signer app, so it reflects the actual on-device version
    // whether Solana is opened directly or via Exchange orchestration.
    return { isCompatible: true, version: appConfig.version };
  }
}
