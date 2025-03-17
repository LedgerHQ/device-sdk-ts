import {
  type DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
} from "@ledgerhq/device-management-kit";
import { gt, gte } from "semver";

import { ETHEREUM_PLUGINS } from "@internal/app-binder/constant/plugins";

export class ApplicationChecker {
  private isCompatible: boolean = true;
  private version: string = "0.0.1";
  private modelId: DeviceModelId;

  constructor(deviceState: DeviceSessionState) {
    this.modelId = deviceState.deviceModelId;

    // If device is not ready or app is unexpected, checker cannot be successful
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      this.isCompatible = false;
      return;
    }
    if (
      deviceState.currentApp.name !== "Ethereum" &&
      !ETHEREUM_PLUGINS.includes(deviceState.currentApp.name)
    ) {
      this.isCompatible = false;
      return;
    }
    this.version = deviceState.currentApp.version;
  }

  withMinVersionInclusive(version: string): ApplicationChecker {
    if (!gte(this.version, version)) {
      this.isCompatible = false;
    }
    return this;
  }

  withMinVersionExclusive(version: string): ApplicationChecker {
    if (!gt(this.version, version)) {
      this.isCompatible = false;
    }
    return this;
  }

  excludeDeviceModel(modelId: DeviceModelId): ApplicationChecker {
    if (this.modelId === modelId) {
      this.isCompatible = false;
    }
    return this;
  }

  check(): boolean {
    return this.isCompatible;
  }
}
