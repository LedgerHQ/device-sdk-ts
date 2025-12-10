import semver from "semver";

import { DeviceStatus } from "@api/device/DeviceStatus";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { UnknownDAError } from "@api/device-action/os/Errors";
import type { TransportDeviceModel } from "@api/device-model/model/DeviceModel";
import type { DeviceSessionState } from "@api/device-session/DeviceSessionState";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import type { Application } from "@internal/manager-api/model/Application";
import type { FinalFirmware } from "@internal/manager-api/model/Firmware";

import { PredictOutOfMemoryTask } from "./PredictOutOfMemoryTask";

describe("PredictOutOfMemoryTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getDeviceModel.mockReturnValue({
      memorySize: 1569792,
      getBlockSize: () => 32,
    } as unknown as TransportDeviceModel);
  });

  it("Success enough memory", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareUpdateContext: {
        currentFirmware: { bytes: 397824 } as FinalFirmware,
      },
      customImage: { size: 51893 },
      installedApps: [
        { bytes: 305442 },
        { bytes: 514598 },
        { bytes: 271583 },
      ] as unknown as Application[],
      installedLanguages: [{ id: 1, size: 20480 }],
      firmwareVersion: { os: "2.0.0" },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [
        { bytes: 1324 },
        { bytes: 6559 },
      ] as unknown as Application[],
    }).run();

    // THEN
    expect(result).toStrictEqual({
      outOfMemory: false,
    });
  });

  it("Success not enough memory", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareUpdateContext: {
        currentFirmware: { bytes: 397824 } as FinalFirmware,
      },
      customImage: { size: 51893 },
      installedApps: [
        { bytes: 305442 },
        { bytes: 514598 },
        { bytes: 271583 },
      ] as unknown as Application[],
      installedLanguages: [{ id: 1, size: 20480 }],
      firmwareVersion: { os: "2.0.0" },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [
        { bytes: 1324 },
        { bytes: 6559 },
        { bytes: 1 },
      ] as unknown as Application[],
    }).run();

    // THEN
    expect(result).toStrictEqual({
      outOfMemory: true,
    });
  });

  it("Success enough memory (recent Nano S, 2kB block size)", () => {
    // GIVEN
    apiMock.getDeviceModel.mockReturnValueOnce({
      memorySize: 12 * 1024,
      getBlockSize: ({ firmwareVersion }: { firmwareVersion: string }) => {
        return semver.lt(semver.coerce(firmwareVersion) ?? "", "2.0.0")
          ? 4 * 1024
          : 2 * 1024;
      },
    } as unknown as TransportDeviceModel);

    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareUpdateContext: {
        currentFirmware: { bytes: 6 * 1024 } as FinalFirmware,
      },
      customImage: { size: 0 },
      installedApps: [],
      installedLanguages: [],
      firmwareVersion: { os: "2.0.0" },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [{ bytes: 6 * 1024 }] as unknown as Application[],
    }).run();

    // THEN
    // 6x2kB blocks of total memory (12kB total)
    //  -3*2kB block for firmware (to fit 6kB)
    //  -3*2kB block for install plan (to fit 6kB)
    //  = 0 blocks left, enough memory
    expect(result).toStrictEqual({
      outOfMemory: false,
    });
  });

  it("Success not enough memory (old Nano S, 4kB block size)", () => {
    // GIVEN
    apiMock.getDeviceModel.mockReturnValueOnce({
      memorySize: 12 * 1024,
      getBlockSize: ({ firmwareVersion }: { firmwareVersion: string }) => {
        return semver.lt(semver.coerce(firmwareVersion) ?? "", "2.0.0")
          ? 4 * 1024
          : 2 * 1024;
      },
    } as unknown as TransportDeviceModel);

    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareUpdateContext: {
        currentFirmware: { bytes: 6 * 1024 } as FinalFirmware,
      },
      customImage: { size: 0 },
      installedApps: [],
      installedLanguages: [],
      firmwareVersion: { os: "1.0.0" },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [{ bytes: 6 * 1024 }] as unknown as Application[],
    }).run();

    // THEN
    // 3x4kB blocks of total memory (12kB total)
    //  -2x4kB block for firmware (to fit 6kB)
    //  -2x4kB blocks for install plan (to fit 6kB)
    //  = -1 block left, not enough memory
    expect(result).toStrictEqual({
      outOfMemory: true,
    });
  });

  it("Success undefined sizes", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareUpdateContext: {
        currentFirmware: { bytes: 2 * 1024 } as FinalFirmware,
      },
      customImage: {},
      installedApps: [
        { bytes: 305442 },
        { bytes: null },
        { bytes: 271583 },
      ] as unknown as Application[],
      installedLanguages: [],
      firmwareVersion: { os: "2.0.0" },
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [
        { bytes: 1324 },
        { bytes: 6559 },
      ] as unknown as Application[],
    }).run();

    // THEN
    expect(result).toStrictEqual({
      outOfMemory: false,
    });
  });

  it("Error when device is in incorrect state", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
    } as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [{ bytes: 1324 }] as unknown as Application[],
    }).run();

    // THEN
    expect(result).toStrictEqual({
      error: new UnknownDAError("Invalid device state"),
    });
  });

  it("Error when device session was not populated", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
    } as unknown as DeviceSessionState);

    // WHEN
    const result = new PredictOutOfMemoryTask(apiMock, {
      installPlan: [{ bytes: 1324 }] as unknown as Application[],
    }).run();

    // THEN
    expect(result).toStrictEqual({
      error: new UnknownDAError("Device metadata not fetched"),
    });
  });
});
