import {
  CONTACTS_VERSION_REQUIREMENTS,
  type ContactsModelRequirement,
  isVersionAtLeast,
  SOLANA_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
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

//const UNRELEASED_MIN_VERSION = "10.0.0";
const DEFAULT_VERSION = "0.0.1";
export const SOLANA_MIN_SPL_VERSION = "1.9.2";
export const SOLANA_MIN_DELAYED_SIGNING_VERSION = "1.14.0";

export const SOLANA_MIN_TRANSACTION_CHECKS_VERSION = "1.16.0";
export const SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION = "1.17.0";

/**
 * Contacts versions are owned by contacts-kit, shared with the other signers.
 * Models without Contacts or without a Solana minimum are excluded, and the
 * highest Solana minimum across the remaining models applies to all of them.
 */
function resolveContactsSupport(): {
  minVersion: string;
  excludedModels: DeviceModelId[];
} {
  let minVersion = "0.0.0";
  const excludedModels: DeviceModelId[] = [];
  const requirements = Object.entries(CONTACTS_VERSION_REQUIREMENTS) as [
    DeviceModelId,
    ContactsModelRequirement,
  ][];

  for (const [modelId, requirement] of requirements) {
    const appMinVersion = requirement.supported
      ? requirement.minAppVersion[SOLANA_APP_NAME]
      : undefined;
    if (appMinVersion === undefined) {
      excludedModels.push(modelId);
    } else if (!isVersionAtLeast(minVersion, appMinVersion)) {
      minVersion = appMinVersion;
    }
  }

  return { minVersion, excludedModels };
}

const SOLANA_CONTACTS_SUPPORT = resolveContactsSupport();

export const SOLANA_SIGNER_FEATURES = {
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
    excludedApps: [] as string[],
  },
  genericClearSign: {
    minVersion: SOLANA_MIN_GENERIC_CLEAR_SIGN_VERSION,
    excludedModels: [DeviceModelId.NANO_S],
    excludedApps: ["Exchange"],
  },
  contacts: {
    minVersion: SOLANA_CONTACTS_SUPPORT.minVersion,
    excludedModels: SOLANA_CONTACTS_SUPPORT.excludedModels,
    excludedApps: ["Exchange"],
  },
} as const;

export type SolanaSignerFeaturesNames = keyof typeof SOLANA_SIGNER_FEATURES;

/**
 * Whether the connected Solana app supports a given feature, applying its
 * minimum version plus device-model / orchestrating-app exclusions.
 *
 * Pass `disabledFeatures` to force-disable specific features regardless of
 * firmware version (e.g. for testing or temporary kill-switches).
 */
export function isSolanaSignerFeatureSupported(
  internalApi: InternalApi,
  feature: SolanaSignerFeaturesNames,
  appConfig: AppConfiguration,
  disabledFeatures?: ReadonlySet<SolanaSignerFeaturesNames>,
): boolean {
  if (disabledFeatures?.has(feature)) {
    return false;
  }
  const { minVersion, excludedModels, excludedApps } =
    SOLANA_SIGNER_FEATURES[feature];
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
