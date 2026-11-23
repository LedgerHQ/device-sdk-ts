import {
  type AppConfig,
  ApplicationChecker,
  type ApplicationResolver,
  type DeviceSessionState,
  DeviceSessionStateType,
  type InternalApi,
  type ResolvedApp,
} from "@ledgerhq/device-management-kit";

import { APP_NAME } from "./constants";

const DEFAULT_VERSION = "0.0.1";
export const XRP_MIN_MPT_VERSION = "2.9.0";

export const XRP_SIGNER_FEATURES = {
  mpt: { minVersion: XRP_MIN_MPT_VERSION },
} as const;

export type XrpSignerFeaturesNames = keyof typeof XRP_SIGNER_FEATURES;

/** Whether the connected XRP app supports a given feature. */
export function isXrpSignerFeatureSupported(
  internalApi: InternalApi,
  feature: XrpSignerFeaturesNames,
  appConfig: AppConfig,
): boolean {
  return new ApplicationChecker(
    internalApi.getDeviceSessionState(),
    appConfig,
    new XrpApplicationResolver(),
  )
    .withMinVersionInclusive(XRP_SIGNER_FEATURES[feature].minVersion)
    .check();
}

export class XrpApplicationResolver implements ApplicationResolver {
  resolve(deviceState: DeviceSessionState, appConfig: AppConfig): ResolvedApp {
    if (
      deviceState.sessionStateType === DeviceSessionStateType.Connected ||
      deviceState.currentApp?.name !== APP_NAME
    ) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    return { isCompatible: true, version: appConfig.version };
  }
}
