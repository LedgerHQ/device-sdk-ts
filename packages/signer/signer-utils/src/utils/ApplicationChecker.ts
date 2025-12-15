import {
  type DeviceModelId,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";
import { gt, gte } from "semver";

import {
  type ApplicationResolver,
  DefaultApplicationResolver,
} from "./ApplicationResolver";

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
  private isCompatible: boolean;
  private version: string;
  private modelId: DeviceModelId;

  constructor(
    deviceState: DeviceSessionState,
    appConfig: AppConfig,
    expectedApp: ApplicationCheckerSupportedAppNames,
    resolver: ApplicationResolver = new DefaultApplicationResolver(),
  ) {
    this.modelId = deviceState.deviceModelId;
    const resolved = resolver.resolve(deviceState, appConfig, expectedApp);
    this.isCompatible = resolved.isCompatible;
    this.version = resolved.version;
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
