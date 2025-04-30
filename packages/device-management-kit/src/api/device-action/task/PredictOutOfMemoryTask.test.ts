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
      blockSize: 32,
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

  it("Success undefined sizes", () => {
    // GIVEN
    apiMock.getDeviceSessionState.mockReturnValueOnce({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareUpdateContext: {
        currentFirmware: { bytes: 397824 } as FinalFirmware,
      },
      customImage: {},
      installedApps: [
        { bytes: 305442 },
        { bytes: null },
        { bytes: 271583 },
      ] as unknown as Application[],
      installedLanguages: [],
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
