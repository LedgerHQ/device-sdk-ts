import type { InternalApi } from "@api/device-action/DeviceAction";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
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
  private readonly deviceModel: TransportDeviceModel;

  constructor(
    private readonly api: InternalApi,
    private readonly args: PredictOutOfMemoryTaskArgs,
  ) {
    this.deviceModel = api.getDeviceModel();
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
      deviceState.installedLanguages === undefined ||
      deviceState.firmwareVersion === undefined
    ) {
      return { error: new UnknownDAError("Device metadata not fetched") };
    }

    const blockSize = this.deviceModel.getBlockSize({
      firmwareVersion: deviceState.firmwareVersion.os,
    });
    const memoryBlocks = Math.floor(this.deviceModel.memorySize / blockSize);

    function bytesToBlocks(size: number) {
      return Math.ceil(size / blockSize);
    }

    // Compute device memory layout
    const firmwareBlocks = bytesToBlocks(
      deviceState.firmwareUpdateContext.currentFirmware.bytes || 0,
    );
    const customImageBlocks = bytesToBlocks(deviceState.customImage.size || 0);
    const applicationsBlocks = deviceState.installedApps.reduce(
      (size, app) => size + bytesToBlocks(app.bytes || 0),
      0,
    );
    const languagesBlocks = deviceState.installedLanguages.reduce(
      (size, lang) => size + bytesToBlocks(lang.size),
      0,
    );
    const usedBlocks =
      firmwareBlocks + customImageBlocks + applicationsBlocks + languagesBlocks;
    const availableBlocks = memoryBlocks - usedBlocks;

    // Compute install plan memory consumption
    const installPlanBlocks = this.args.installPlan.reduce(
      (size, app) => size + bytesToBlocks(app.bytes || 0),
      0,
    );

    return { outOfMemory: installPlanBlocks > availableBlocks };
  }
}
