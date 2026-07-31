import {
  type CommandErrorResult,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { GetBackgroundImageSizeCommand } from "@api/command/os/GetBackgroundImageSizeCommand";
import { GetOsVersionCommand } from "@api/command/os/GetOsVersionCommand";
import type { InternalApi } from "@api/device-action/DeviceAction";
import { InvalidGetFirmwareMetadataResponseError } from "@api/device-action/task/Errors";
import {
  type CustomImage,
  type FirmwareUpdate,
  type FirmwareUpdateContext,
  type FirmwareVersion,
} from "@api/device-session/DeviceSessionState";
import { type DmkResult, DmkResultFactory } from "@api/model/DmkResult";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import {
  type FinalFirmware,
  type OsuFirmware,
} from "@internal/manager-api/model/Firmware";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

export type GetFirmwareMetadataTaskResponse = {
  deviceVersion: DeviceVersion;
  firmware: FinalFirmware;
  firmwareVersion: FirmwareVersion;
  firmwareUpdateContext: FirmwareUpdateContext;
  customImage: CustomImage;
};

export type GetFirmwareMetadataTaskError =
  | CommandErrorResult["error"]
  | InvalidGetFirmwareMetadataResponseError;

export type GetFirmwareMetadataTaskResult = DmkResult<
  GetFirmwareMetadataTaskResponse,
  GetFirmwareMetadataTaskError
>;

export class GetFirmwareMetadataTask {
  constructor(private readonly api: InternalApi) {}

  async run(): Promise<GetFirmwareMetadataTaskResult> {
    // Get installed firmware metadata
    const osVersion = await this.api.sendCommand(new GetOsVersionCommand());
    if (!isSuccessCommandResult(osVersion)) {
      return DmkResultFactory({
        error: osVersion.error,
      });
    }
    const firmwareVersion: FirmwareVersion = {
      mcu: osVersion.data.mcuSephVersion,
      bootloader: osVersion.data.mcuBootloaderVersion,
      os: osVersion.data.seVersion,
      metadata: osVersion.data,
    };

    // Fetch current firmware metadata from app store
    const manager = this.api.getManagerApiService();
    const result = await manager
      .getDeviceVersion(osVersion.data)
      .chain((deviceVersion) =>
        manager
          .getFirmwareVersion(osVersion.data, deviceVersion)
          .map((currentFirmware) => ({ deviceVersion, currentFirmware })),
      );
    if (result.isLeft()) {
      return DmkResultFactory({
        error: new InvalidGetFirmwareMetadataResponseError(),
      });
    }
    const { deviceVersion, currentFirmware } = result.unsafeCoerce();

    const availableUpdate = await this.getAvailableUpdate(
      manager,
      currentFirmware,
      deviceVersion,
      firmwareVersion,
    );

    const firmwareUpdateContext = {
      currentFirmware,
      availableUpdate,
    };

    // Get custom image metadata
    let customImage: CustomImage = {};
    const imageSize = await this.api.sendCommand(
      new GetBackgroundImageSizeCommand(),
    );
    if (isSuccessCommandResult(imageSize)) {
      customImage = { size: imageSize.data };
    }

    // Return firmware metadata
    return DmkResultFactory({
      data: {
        deviceVersion,
        firmware: currentFirmware,
        firmwareVersion,
        firmwareUpdateContext,
        customImage,
      },
    });
  }

  private async getAvailableUpdate(
    manager: ManagerApiService,
    currentFirmware: FinalFirmware,
    deviceVersion: DeviceVersion,
    firmwareVersion: FirmwareVersion,
  ): Promise<FirmwareUpdate | undefined> {
    // Fetch latest firmware available, if any
    const maybeOsuFirmwareResult = await manager.getLatestFirmwareVersion(
      currentFirmware,
      deviceVersion,
    );
    if (maybeOsuFirmwareResult.isLeft()) {
      return undefined;
    }

    const maybeOsuFirmware = maybeOsuFirmwareResult.unsafeCoerce();
    if (maybeOsuFirmware.isNothing()) {
      return undefined;
    }

    return this.getFirmwareUpdate(
      manager,
      maybeOsuFirmware.unsafeCoerce(),
      firmwareVersion,
    );
  }

  private async getFirmwareUpdate(
    manager: ManagerApiService,
    osuFirmware: OsuFirmware,
    firmwareVersion: FirmwareVersion,
  ): Promise<FirmwareUpdate | undefined> {
    const finalFirmwareResult =
      await manager.getNextFirmwareVersion(osuFirmware);
    if (finalFirmwareResult.isLeft()) {
      return undefined;
    }

    const mcusResult = await manager.getMcuList();
    if (mcusResult.isLeft()) {
      return undefined;
    }

    const finalFirmware = finalFirmwareResult.unsafeCoerce();
    const mcu = mcusResult
      .unsafeCoerce()
      .find((candidate) => candidate.name === firmwareVersion.mcu);

    return {
      osuFirmware,
      finalFirmware,
      mcuUpdateRequired:
        mcu === undefined || !finalFirmware.mcuVersions.includes(mcu.id),
    };
  }
}
