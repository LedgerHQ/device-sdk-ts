import {
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@ledgerhq/device-management-kit";

import {
  type AppConfig,
  ApplicationCheckerInternalAppNames,
  ApplicationCheckerSupportedAppNames,
} from "./ApplicationChecker";

export type ResolvedApp = {
  readonly isCompatible: boolean;
  readonly version: string;
};

export interface ApplicationResolver {
  resolve(
    deviceState: DeviceSessionState,
    appConfig: AppConfig,
    expectedApp: ApplicationCheckerSupportedAppNames,
  ): ResolvedApp;
}

const DEFAULT_VERSION = "0.0.1";

export class DefaultApplicationResolver implements ApplicationResolver {
  resolve(
    deviceState: DeviceSessionState,
    appConfig: AppConfig,
    expectedApp: ApplicationCheckerSupportedAppNames,
  ): ResolvedApp {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    const currentApp = deviceState.currentApp;
    const appName = currentApp?.name;

    if (!appName) {
      return { isCompatible: false, version: DEFAULT_VERSION };
    }

    switch (expectedApp) {
      case ApplicationCheckerSupportedAppNames.Solana: {
        if (appName === ApplicationCheckerSupportedAppNames.Solana) {
          return { isCompatible: true, version: currentApp.version };
        }
        return { isCompatible: false, version: DEFAULT_VERSION };
      }

      case ApplicationCheckerSupportedAppNames.Ethereum: {
        if (appName === ApplicationCheckerInternalAppNames.Exchange) {
          return { isCompatible: false, version: DEFAULT_VERSION };
        }

        const version =
          appName === ApplicationCheckerSupportedAppNames.Ethereum
            ? currentApp.version
            : appConfig.version;

        return { isCompatible: true, version };
      }
    }
  }
}
