import { EitherAsync } from "purify-ts";

import {
  InvalidGetFirmwareMetadataResponseError,
  InvalidStatusWordError,
} from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { type GetOsVersionResponse } from "@api/command/os/GetOsVersionCommand";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import {
  type FinalFirmware,
  type McuFirmware,
  type OsuFirmware,
} from "@internal/manager-api/model/Firmware";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { GetFirmwareMetadataTask } from "./GetFirmwareMetadataTask";

describe("GetFirmwareMetadataTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const OS_VERSION = {
    mcuSephVersion: "mcu_version",
    mcuBootloaderVersion: "bl_version",
    seVersion: "se_version",
  } as GetOsVersionResponse;

  const CUSTOM_IMAGE_SIZE = 97;

  const DEVICE_VERSION = {
    id: 7,
  };

  const FIRMWARE_VERSION = {
    id: 361,
    version: "1.6.0",
    perso: "perso_11",
  } as FinalFirmware;

  const OSU_VERSION = {
    id: 362,
    perso: "perso_11",
  } as OsuFirmware;

  const NEXT_FIRMWARE_VERSION = {
    id: 363,
    version: "1.7.0",
    perso: "perso_11",
    mcuVersions: [1],
  } as FinalFirmware;

  const MCUS = [
    {
      id: 3,
      name: "other_version",
    },
    {
      id: 1,
      name: "mcu_version",
    },
  ] as McuFirmware[];

  const MANAGER_MOCK = {
    getDeviceVersion: vi.fn(),
    getFirmwareVersion: vi.fn(),
    getLatestFirmwareVersion: vi.fn(),
    getNextFirmwareVersion: vi.fn(),
    getMcuList: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    apiMock.getManagerApiService.mockReturnValue(
      MANAGER_MOCK as unknown as ManagerApiService,
    );
    MANAGER_MOCK.getDeviceVersion.mockReturnValue(
      EitherAsync(async () => DEVICE_VERSION),
    );
    MANAGER_MOCK.getFirmwareVersion.mockReturnValue(
      EitherAsync(async () => FIRMWARE_VERSION),
    );
    MANAGER_MOCK.getLatestFirmwareVersion.mockReturnValue(
      EitherAsync(async () => OSU_VERSION),
    );
    MANAGER_MOCK.getNextFirmwareVersion.mockReturnValue(
      EitherAsync(async () => NEXT_FIRMWARE_VERSION),
    );
    MANAGER_MOCK.getMcuList.mockReturnValue(EitherAsync(async () => MCUS));
  });

  it("success with no firmware update available", async () => {
    // GIVEN
    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: OS_VERSION }))
      .mockResolvedValueOnce(CommandResultFactory({ data: CUSTOM_IMAGE_SIZE }));
    MANAGER_MOCK.getLatestFirmwareVersion.mockReturnValueOnce(
      EitherAsync(async ({ throwE }) => {
        throwE(new Error("error"));
      }),
    );

    // WHEN
    const result = await new GetFirmwareMetadataTask(apiMock).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          deviceVersion: DEVICE_VERSION,
          firmware: FIRMWARE_VERSION,
          firmwareVersion: {
            mcu: "mcu_version",
            bootloader: "bl_version",
            os: "se_version",
            metadata: OS_VERSION,
          },
          firmwareUpdateContext: {
            currentFirmware: FIRMWARE_VERSION,
            availableUpdate: undefined,
          },
          customImage: { size: CUSTOM_IMAGE_SIZE },
        },
      }),
    );
  });

  it("success with a firmware update available", async () => {
    // GIVEN
    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: OS_VERSION }))
      .mockResolvedValueOnce(
        CommandResultFactory({ error: new InvalidStatusWordError("error") }),
      );

    // WHEN
    const result = await new GetFirmwareMetadataTask(apiMock).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          deviceVersion: DEVICE_VERSION,
          firmware: FIRMWARE_VERSION,
          firmwareVersion: {
            mcu: "mcu_version",
            bootloader: "bl_version",
            os: "se_version",
            metadata: OS_VERSION,
          },
          firmwareUpdateContext: {
            currentFirmware: FIRMWARE_VERSION,
            availableUpdate: {
              osuFirmware: OSU_VERSION,
              finalFirmware: NEXT_FIRMWARE_VERSION,
              mcuUpdateRequired: false,
            },
          },
          customImage: {},
        },
      }),
    );
    expect(MANAGER_MOCK.getDeviceVersion).toHaveBeenCalledWith(OS_VERSION);
    expect(MANAGER_MOCK.getFirmwareVersion).toHaveBeenCalledWith(
      OS_VERSION,
      DEVICE_VERSION,
    );
    expect(MANAGER_MOCK.getLatestFirmwareVersion).toHaveBeenCalledWith(
      FIRMWARE_VERSION,
      DEVICE_VERSION,
    );
    expect(MANAGER_MOCK.getNextFirmwareVersion).toHaveBeenCalledWith(
      OSU_VERSION,
    );
  });

  it("success with a firmware update available and MCU update", async () => {
    // GIVEN
    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: OS_VERSION }))
      .mockResolvedValueOnce(
        CommandResultFactory({ error: new InvalidStatusWordError("error") }),
      );
    const nextFirmware = {
      ...NEXT_FIRMWARE_VERSION,
      mcuVersions: [3],
    };
    MANAGER_MOCK.getNextFirmwareVersion.mockReturnValue(
      EitherAsync(async () => nextFirmware),
    );

    // WHEN
    const result = await new GetFirmwareMetadataTask(apiMock).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          deviceVersion: DEVICE_VERSION,
          firmware: FIRMWARE_VERSION,
          firmwareVersion: {
            mcu: "mcu_version",
            bootloader: "bl_version",
            os: "se_version",
            metadata: OS_VERSION,
          },
          firmwareUpdateContext: {
            currentFirmware: FIRMWARE_VERSION,
            availableUpdate: {
              osuFirmware: OSU_VERSION,
              finalFirmware: nextFirmware,
              mcuUpdateRequired: true,
            },
          },
          customImage: {},
        },
      }),
    );
  });

  it("should fail when OS version cannot be retrieved", async () => {
    // GIVEN
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ error: new InvalidStatusWordError("error") }),
    );

    // WHEN
    const result = await new GetFirmwareMetadataTask(apiMock).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({ error: new InvalidStatusWordError("error") }),
    );
  });

  it("should fail if device version cannot be fetched with InvalidGetFirmwareMetadataResponseError", async () => {
    // GIVEN
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OS_VERSION }),
    );
    MANAGER_MOCK.getDeviceVersion.mockReturnValueOnce(
      EitherAsync(async ({ throwE }) => {
        throwE(new Error("error"));
      }),
    );

    // WHEN
    const result = await new GetFirmwareMetadataTask(apiMock).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidGetFirmwareMetadataResponseError(),
      }),
    );
  });

  it("should fail if firmware version cannot be fetched with InvalidGetFirmwareMetadataResponseError", async () => {
    // GIVEN
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OS_VERSION }),
    );
    MANAGER_MOCK.getFirmwareVersion.mockReturnValueOnce(
      EitherAsync(async ({ throwE }) => {
        throwE(new Error("error"));
      }),
    );

    // WHEN
    const result = await new GetFirmwareMetadataTask(apiMock).run();

    // THEN
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidGetFirmwareMetadataResponseError(),
      }),
    );
  });
});
