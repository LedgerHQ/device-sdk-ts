import { gt, gte } from "semver";

import { type DeviceModelId } from "@api/device/DeviceModel";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";

import {
  type AppConfig,
  type ApplicationResolver,
} from "./ApplicationResolver";

export class ApplicationChecker {
  private isCompatible: boolean;
  private version: string;
  private modelId: DeviceModelId;

  constructor(
    deviceState: DeviceSessionState,
    appConfig: AppConfig,
    resolver: ApplicationResolver,
  ) {
    this.modelId = deviceState.deviceModelId;
    const resolved = resolver.resolve(deviceState, appConfig);
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
