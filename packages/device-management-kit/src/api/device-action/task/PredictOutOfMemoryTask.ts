import type { InternalApi } from "@api/device-action/DeviceAction";
import { UnknownDAError } from "@api/device-action/os/Errors";
import { type TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import {
  type CustomImage,
  DeviceSessionStateType,
  type FirmwareUpdateContext,
  type FirmwareVersion,
  type InstalledLanguagePackage,
} from "@api/device-session/DeviceSessionState";
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
    const deviceState = this.api.getDeviceSessionState();

    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return { error: new UnknownDAError("Invalid device state") };
    }

    const {
      firmwareUpdateContext,
      customImage,
      firmwareVersion,
      installedLanguages,
      installedApps,
    } = deviceState;

    if (
      firmwareUpdateContext === undefined ||
      customImage === undefined ||
      firmwareVersion === undefined ||
      installedLanguages === undefined
    ) {
      return { error: new UnknownDAError("Device metadata not fetched") };
    }

    const { blockSize, totalMemoryBlocks } =
      this.getMemoryConstants(firmwareVersion);

    const currentMemoryBlocksUsage = this.getCurrentMemoryBlocksUsage({
      firmwareUpdateContext,
      customImage,
      installedApps,
      installedLanguages,
      blockSize,
    });

    const installPlanBlocksUsage = this.getInstallPlanMemoryBlocksUsage(
      this.args.installPlan,
      blockSize,
    );

    return {
      outOfMemory:
        currentMemoryBlocksUsage + installPlanBlocksUsage > totalMemoryBlocks,
    };
  }

  private getMemoryConstants(firmwareVersion: FirmwareVersion): {
    blockSize: number;
    totalMemoryBlocks: number;
  } {
    const blockSize = this.deviceModel.getBlockSize({
      firmwareVersion: firmwareVersion.os,
    });
    const totalMemoryBlocks = Math.floor(
      this.deviceModel.memorySize / blockSize,
    );
    return { blockSize, totalMemoryBlocks };
  }

  private getCurrentMemoryBlocksUsage({
    firmwareUpdateContext,
    customImage,
    installedApps,
    installedLanguages,
    blockSize,
  }: {
    firmwareUpdateContext: FirmwareUpdateContext;
    customImage: CustomImage;
    installedApps: Application[];
    installedLanguages: InstalledLanguagePackage[];
    blockSize: number;
  }): number {
    const bytesToBlocks = (size: number) => Math.ceil(size / blockSize);
    const firmwareBlocks = bytesToBlocks(
      firmwareUpdateContext.currentFirmware.bytes || 0,
    );
    const customImageBlocks = bytesToBlocks(customImage.size || 0);
    const applicationsBlocks = installedApps.reduce(
      (size, app) => size + bytesToBlocks(app.bytes || 0),
      0,
    );
    const languagesBlocks = installedLanguages.reduce(
      (size, lang) => size + bytesToBlocks(lang.size),
      0,
    );
    return (
      firmwareBlocks + customImageBlocks + applicationsBlocks + languagesBlocks
    );
  }

  private getInstallPlanMemoryBlocksUsage(
    installPlan: Application[],
    blockSize: number,
  ): number {
    const bytesToBlocks = (size: number) => Math.ceil(size / blockSize);
    return installPlan.reduce(
      (size, app) => size + bytesToBlocks(app.bytes || 0),
      0,
    );
  }
}
