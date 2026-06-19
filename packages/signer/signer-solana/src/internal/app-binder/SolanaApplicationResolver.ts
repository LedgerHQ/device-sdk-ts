import {
  type AppConfig,
  ApplicationChecker,
  type ApplicationResolver,
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  type InternalApi,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";

import { APP_NAME } from "./constants";

const UNRELEASED_MIN_VERSION = "10.0.0";
const DEFAULT_VERSION = "0.0.1";
export const SOLANA_MIN_SPL_VERSION = "1.9.2";
export const SOLANA_MIN_DELAYED_SIGNING_VERSION = "1.14.0";

export const SOLANA_MIN_WEB3_CHECKS_VERSION = UNRELEASED_MIN_VERSION;
export const SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION = UNRELEASED_MIN_VERSION;

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
  genericClearSign: {
    minVersion: SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION,
    excludedModels: [DeviceModelId.NANO_S],
    excludedApps: ["Exchange"],
  },
} as const;

/**
 * Whether the connected Solana app supports a given feature, applying its
 * minimum version plus device-model / orchestrating-app exclusions.
 */
export function isSolanaFeatureSupported(
  internalApi: InternalApi,
  feature: keyof typeof SOLANA_FEATURES,
  appConfig: AppConfiguration,
): boolean {
  const { minVersion, excludedModels, excludedApps } = SOLANA_FEATURES[feature];
  return new ApplicationChecker(
    internalApi.getDeviceSessionState(),
    appConfig,
    new SolanaApplicationResolver(),
  )
    .withMinVersionInclusive(minVersion)
    .excludeDeviceModels(...excludedModels)
    .excludeApps(...excludedApps)
    .check();
}

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
