import {
  ErrorLanguageNotFound,
  InvalidGetFirmwareMetadataResponseError,
} from "@api/command/Errors";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import type { InternalApi } from "@api/device-action/DeviceAction";
import { type Language } from "@api/device-action/os/InstallLanguagePackage/types";
import { type LanguagePackage } from "@internal/manager-api/model/Language";

export type GetLanguagePackageByLanguageTaskArgs = {
  readonly deviceInfo: GetOsVersionResponse;
  readonly language: Language;
};

export type GetLanguagePackageByLanguageTaskResult =
  CommandResult<LanguagePackage>;

/**
 * Resolves a catalog {@link LanguagePackage} for the device/firmware pair, using the same
 * Manager API flow as {@link GetApplicationsMetadataTask#getLanguagePackages}.
 */
export class GetLanguagePackageByLanguageTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetLanguagePackageByLanguageTaskArgs,
  ) {}

  async run(): Promise<GetLanguagePackageByLanguageTaskResult> {
    const manager = this.api.getManagerApiService();
    const osVersion = this.args.deviceInfo;

    const result = await manager
      .getDeviceVersion(osVersion)
      .chain((deviceVersion) =>
        manager
          .getFirmwareVersion(osVersion, deviceVersion)
          .map((currentFirmware) => ({ deviceVersion, currentFirmware })),
      );

    if (result.isLeft()) {
      return CommandResultFactory({
        error: new InvalidGetFirmwareMetadataResponseError(),
      });
    }

    const { deviceVersion, currentFirmware } = result.unsafeCoerce();
    const languages = await manager.getLanguagePackages(
      deviceVersion,
      currentFirmware,
    );

    if (!languages.isRight()) {
      return CommandResultFactory({
        error: new InvalidGetFirmwareMetadataResponseError(
          "Cannot get the languages catalog",
        ),
      });
    }

    const languagePack = languages
      .extract()
      .find((p) => p.language === this.args.language);

    if (languagePack === undefined) {
      return CommandResultFactory({
        error: new ErrorLanguageNotFound(this.args.language),
      });
    }

    return CommandResultFactory({ data: languagePack });
  }
}
