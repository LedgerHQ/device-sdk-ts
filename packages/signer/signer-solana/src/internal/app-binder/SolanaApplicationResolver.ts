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

const DEFAULT_VERSION = "0.0.1";
export const SOLANA_MIN_SPL_VERSION = "1.9.2";
export const SOLANA_MIN_DELAYED_SIGNING_VERSION = "1.14.0";

export const SOLANA_MIN_TRANSACTION_CHECKS_VERSION = "1.16.0";
export const SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION = "1.17.0";
export const SOLANA_MIN_V1_TRANSACTIONS_VERSION = "1.18.0";
export const SOLANA_MIN_V1_GATING_VERSION = "1.18.0";

/**
 * Always on
 */
export const SOLANA_DEFAULT_FEATURES = {
  gatedSigning: {
    minVersion: SOLANA_MIN_V1_GATING_VERSION,
    excludedModels: [DeviceModelId.NANO_S],
    excludedApps: ["Exchange"],
  },
} as const;

/** Features callers can turn off with `disabledFeatures`. */
export const SOLANA_FEATURES = {
  spl: {
    minVersion: SOLANA_MIN_SPL_VERSION,
    excludedModels: [DeviceModelId.NANO_S],
    excludedApps: [] as string[],
  },
  transactionChecks: {
    minVersion: SOLANA_MIN_TRANSACTION_CHECKS_VERSION,
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
    excludedApps: ["Exchange"],
  },
  genericClearSign: {
    minVersion: SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION,
    excludedModels: [DeviceModelId.NANO_S],
    excludedApps: ["Exchange"],
  },
  v1Transactions: {
    minVersion: SOLANA_MIN_V1_TRANSACTIONS_VERSION,
    excludedModels: [] as DeviceModelId[],
    excludedApps: [] as string[],
  },
} as const;

export type SolanaSignerFeaturesNames = keyof typeof SOLANA_FEATURES;

const ALL_SOLANA_FEATURES = { ...SOLANA_DEFAULT_FEATURES, ...SOLANA_FEATURES };

export type SolanaFeatureName = keyof typeof ALL_SOLANA_FEATURES;

/**
 * Whether the connected Solana app supports a given feature, applying its
 * minimum version plus device-model / orchestrating-app exclusions.
 *
 * Pass `disabledFeatures` to force-disable specific features regardless of
 * firmware version (e.g. for testing or temporary kill-switches).
 */
export function isSolanaSignerFeatureSupported(
  internalApi: InternalApi,
  feature: SolanaFeatureName,
  appConfig: AppConfiguration,
  disabledFeatures?: ReadonlySet<SolanaSignerFeaturesNames>,
): boolean {
  // Only SOLANA_FEATURES can be disabled
  if (
    feature in SOLANA_FEATURES &&
    disabledFeatures?.has(feature as SolanaSignerFeaturesNames)
  ) {
    return false;
  }
  const { minVersion, excludedModels, excludedApps } =
    ALL_SOLANA_FEATURES[feature];
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
