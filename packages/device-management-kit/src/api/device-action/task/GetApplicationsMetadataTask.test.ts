import { EitherAsync } from "purify-ts";

import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import {
  BTC_APP_METADATA,
  ETH_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { type FirmwareVersion } from "@api/device-session/DeviceSessionState";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";
import { type LanguagePackage } from "@internal/manager-api/model/Language";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { GetApplicationsMetadataTask } from "./GetApplicationsMetadataTask";

describe("GetApplicationsMetadataTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  const DEVICE_VERSION = {
    id: 7,
  } as DeviceVersion;

  const FIRMWARE = {
    id: 361,
    version: "1.6.0",
    perso: "perso_11",
  } as FinalFirmware;

  const FIRMWARE_VERSION = {
    mcu: "mcu_version",
    bootloader: "bl_version",
    os: "se_version",
    metadata: "metadata",
  } as unknown as FirmwareVersion;

  const INSTALLED_APPS = [
    { name: "Ethereum", hash: "hash2", hashCode: "hashCode" },
    {
      name: "Language",
      hash: "hash3",
      hashCode:
        "0000000000000000000000000000000000000000000000000000000000000000",
    },
  ];

  const APPS = [ETH_APP_METADATA];

  const CATALOG = [BTC_APP_METADATA, ETH_APP_METADATA];

  const LANGUAGES = ["fr", "eng", "it"] as unknown as LanguagePackage[];

  const ARGS = {
    deviceVersion: DEVICE_VERSION,
    firmware: FIRMWARE,
    firmwareVersion: FIRMWARE_VERSION,
    installedApps: INSTALLED_APPS,
  };

  const MANAGER_MOCK = {
    getAppsByHash: vi.fn(),
    getAppList: vi.fn(),
    getLanguagePackages: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    apiMock.getManagerApiService.mockReturnValue(
      MANAGER_MOCK as unknown as ManagerApiService,
    );
    MANAGER_MOCK.getAppsByHash.mockReturnValue(EitherAsync(async () => APPS));
    MANAGER_MOCK.getAppList.mockReturnValue(EitherAsync(async () => CATALOG));
    MANAGER_MOCK.getLanguagePackages.mockReturnValue(
      EitherAsync(async () => LANGUAGES),
    );
  });

  it("Success without updates", async () => {
    // WHEN
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          applications: APPS,
          applicationsUpdates: [],
          installedLanguages: [],
          catalog: {
            applications: CATALOG,
            languagePackages: LANGUAGES,
          },
        },
      }),
    );
  });

  it("Success without languages", async () => {
    // WHEN
    apiMock.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { id: 1, size: 15 } }),
      )
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { id: 2, size: 17 } }),
      );
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          applications: APPS,
          applicationsUpdates: [],
          installedLanguages: [
            { id: 1, size: 15 },
            { id: 2, size: 17 },
          ],
          catalog: {
            applications: CATALOG,
            languagePackages: LANGUAGES,
          },
        },
      }),
    );
  });

  it("Success with an available update", async () => {
    // GIVEN
    const app = {
      ...BTC_APP_METADATA,
      version: "1.0.0",
    };
    MANAGER_MOCK.getAppsByHash.mockReturnValue(EitherAsync(async () => [app]));

    // WHEN
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          applications: [app],
          applicationsUpdates: [BTC_APP_METADATA],
          installedLanguages: [],
          catalog: {
            applications: CATALOG,
            languagePackages: LANGUAGES,
          },
        },
      }),
    );
    expect(MANAGER_MOCK.getAppsByHash).toHaveBeenCalledWith(["hash2"]);
  });

  it("Success with app hash not found", async () => {
    // GIVEN
    MANAGER_MOCK.getAppsByHash.mockReturnValue(EitherAsync(async () => [null]));

    // WHEN
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          applications: APPS,
          applicationsUpdates: [],
          installedLanguages: [],
          catalog: {
            applications: CATALOG,
            languagePackages: LANGUAGES,
          },
        },
      }),
    );
  });

  it("should fail when apps hash cannot by retrieved", async () => {
    // GIVEN
    MANAGER_MOCK.getAppsByHash.mockReturnValueOnce(
      EitherAsync(async ({ throwE }) => {
        throwE(new Error("error"));
      }),
    );

    // WHEN
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Cannot get the application catalog"),
      }),
    );
  });

  it("should fail when apps list cannot by retrieved", async () => {
    // GIVEN
    MANAGER_MOCK.getAppList.mockReturnValueOnce(
      EitherAsync(async ({ throwE }) => {
        throwE(new Error("error"));
      }),
    );

    // WHEN
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Cannot get the application catalog"),
      }),
    );
  });

  it("should fail when languages cannot by retrieved", async () => {
    // GIVEN
    MANAGER_MOCK.getLanguagePackages.mockReturnValueOnce(
      EitherAsync(async ({ throwE }) => {
        throwE(new Error("error"));
      }),
    );

    // WHEN
    const result = await new GetApplicationsMetadataTask(apiMock, ARGS).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("Cannot get the languages catalog"),
      }),
    );
  });
});
