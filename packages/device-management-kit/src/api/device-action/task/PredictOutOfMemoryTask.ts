import type { InternalApi } from "@api/device-action/DeviceAction";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import type { Application } from "@internal/manager-api/model/Application";

export type PredictOutOfMemoryTaskArgs = {
  installPlan: Application[];
};

export type PredictOutOfMemoryTaskResult =
  | {
      outOfMemory: boolean;
    }
  | {
      error: UnknownDAError;
    };

export class PredictOutOfMemoryTask {
  private readonly blockSize: number;
  private readonly memoryBlocks: number;

  constructor(
    private readonly api: InternalApi,
    private readonly args: PredictOutOfMemoryTaskArgs,
  ) {
    const deviceModel = api.getDeviceModel();
    this.blockSize = deviceModel.blockSize;
    this.memoryBlocks = Math.floor(deviceModel.memorySize / this.blockSize);
  }

  run(): PredictOutOfMemoryTaskResult {
    // Get device session state.
    const deviceState = this.api.getDeviceSessionState();
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { error: new UnknownDAError("Invalid device state") };
    }

    // Ensure the device metadata were correctly fetched.
    if (
      deviceState.firmwareUpdateContext === undefined ||
      deviceState.customImage === undefined ||
      deviceState.installedLanguages === undefined
    ) {
      return { error: new UnknownDAError("Device metadata not fetched") };
    }

    // Compute device memory layout
    const firmwareBlocks = this.bytesToBlocks(
      deviceState.firmwareUpdateContext.currentFirmware.bytes || 0,
    );
    const customImageBlocks = this.bytesToBlocks(
      deviceState.customImage.size || 0,
    );
    const applicationsBlocks = deviceState.installedApps.reduce(
      (size, app) => size + this.bytesToBlocks(app.bytes || 0),
      0,
    );
    const languagesBlocks = deviceState.installedLanguages.reduce(
      (size, lang) => size + this.bytesToBlocks(lang.size),
      0,
    );
    const usedBlocks =
      firmwareBlocks + customImageBlocks + applicationsBlocks + languagesBlocks;
    const availableBlocks = this.memoryBlocks - usedBlocks;

    // Compute install plan memory consumption
    const installPlanBlocks = this.args.installPlan.reduce(
      (size, app) => size + this.bytesToBlocks(app.bytes || 0),
      0,
    );
    return { outOfMemory: installPlanBlocks > availableBlocks };
  }

  private bytesToBlocks(size: number) {
    return Math.ceil(size / this.blockSize);
  }
}
