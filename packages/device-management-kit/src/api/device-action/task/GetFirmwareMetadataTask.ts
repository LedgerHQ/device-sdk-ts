import { InvalidGetFirmwareMetadataResponseError } from "@api/command/Errors";
import {
  type CommandResult,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { GetBackgroundImageSizeCommand } from "@api/command/os/GetBackgroundImageSizeCommand";
import { GetOsVersionCommand } from "@api/command/os/GetOsVersionCommand";
import type { InternalApi } from "@api/device-action/DeviceAction";
import {
  type CustomImage,
  type FirmwareUpdate,
  type FirmwareUpdateContext,
  type FirmwareVersion,
} from "@api/device-session/DeviceSessionState";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export type GetFirmwareMetadataTaskResult = CommandResult<{
  deviceVersion: DeviceVersion;
  firmware: FinalFirmware;
  firmwareVersion: FirmwareVersion;
  firmwareUpdateContext: FirmwareUpdateContext;
  customImage: CustomImage;
}>;

export class GetFirmwareMetadataTask {
  constructor(private readonly api: InternalApi) {}

  async run(): Promise<GetFirmwareMetadataTaskResult> {
    // Get installed firmware metadata
    const osVersion = await this.api.sendCommand(new GetOsVersionCommand());
    if (!isSuccessCommandResult(osVersion)) {
      return osVersion;
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
      return CommandResultFactory({
        error: new InvalidGetFirmwareMetadataResponseError(),
      });
    }
    const { deviceVersion, currentFirmware } = result.unsafeCoerce();

    // Fetch latest firmware available, if any
    const maybeUpdate = await manager
      .getLatestFirmwareVersion(currentFirmware, deviceVersion)
      .chain((osuFirmware) =>
        manager.getNextFirmwareVersion(osuFirmware).chain((finalFirmware) =>
          manager
            .getMcuList()
            .map((mcus) => mcus.find((mcu) => mcu.name === firmwareVersion.mcu))
            .map(
              (mcu) =>
                mcu === undefined ||
                !finalFirmware.mcuVersions.includes(mcu.id),
            )
            .map((mcuUpdateRequired) => ({
              osuFirmware,
              finalFirmware,
              mcuUpdateRequired,
            })),
        ),
      );
    const availableUpdate: FirmwareUpdate | undefined = maybeUpdate.caseOf({
      Right: (data) => data,
      Left: (_error) => undefined,
    });
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
    return CommandResultFactory({
      data: {
        deviceVersion,
        firmware: currentFirmware,
        firmwareVersion,
        firmwareUpdateContext,
        customImage,
      },
    });
  }
}
