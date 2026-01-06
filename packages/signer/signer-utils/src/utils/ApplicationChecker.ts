import {
  type DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@ledgerhq/device-management-kit";
import { gt, gte } from "semver";

export type AppConfig = Record<string, unknown> & {
  readonly version: string;
};

export enum ApplicationCheckerSupportedAppNames {
  Solana = "Solana",
  Ethereum = "Ethereum",
}
export enum ApplicationCheckerInternalAppNames {
  Exchange = "Exchange",
}

export class ApplicationChecker {
  private isCompatible = true;
  private version = "0.0.1";
  private modelId: DeviceModelId;

  constructor(
    deviceState: DeviceSessionState,
    appConfig: AppConfig,
    expectedApp: ApplicationCheckerSupportedAppNames,
  ) {
    this.modelId = deviceState.deviceModelId;

    // If device is not ready, checker cannot be successful
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      this.isCompatible = false;
      return;
    }

    const currentApp = deviceState.currentApp;
    const appName = currentApp?.name;

    if (!appName) {
      this.isCompatible = false;
      return;
    }

    switch (expectedApp) {
      case ApplicationCheckerSupportedAppNames.Solana: {
        if (appName !== ApplicationCheckerSupportedAppNames.Solana) {
          this.isCompatible = false;
          return;
        }
        this.version = currentApp.version;
        return;
      }

      case ApplicationCheckerSupportedAppNames.Ethereum: {
        if (appName === ApplicationCheckerInternalAppNames.Exchange) {
          this.isCompatible = false;
          return;
        }

        if (appName === ApplicationCheckerSupportedAppNames.Ethereum) {
          this.version = currentApp.version;
          return;
        }

        this.version = appConfig.version;
        return;
      }

      default: {
        this.isCompatible = false;
        return;
      }
    }
  }

  withMinVersionInclusive(version: string): ApplicationChecker {
    if (!gte(this.version, version)) this.isCompatible = false;
    return this;
  }

  withMinVersionExclusive(version: string): ApplicationChecker {
    if (!gt(this.version, version)) this.isCompatible = false;
    return this;
  }

  excludeDeviceModel(modelId: DeviceModelId): ApplicationChecker {
    if (this.modelId === modelId) this.isCompatible = false;
    return this;
  }

  check(): boolean {
    return this.isCompatible;
  }
}
