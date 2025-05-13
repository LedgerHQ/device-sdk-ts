import { describe, expect, it, vi } from "vitest";

import { DeviceStatus } from "@api/device/DeviceStatus";
import {
  type Catalog,
  type DeviceSessionState,
  type FirmwareUpdateContext,
  type FirmwareVersion,
} from "@api/device-session/DeviceSessionState";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { type Application } from "@internal/manager-api/model/Application";

import { SetProviderUseCase } from "./SetProviderUseCase";

describe("SetProviderUseCase", () => {
  const getDeviceSessionStateMock = vi.fn();
  const setDeviceSessionStateMock = vi.fn();
  const getDeviceSessionsMock = vi.fn();
  const mockDeviceSession = {
    addDeviceSession: vi.fn(),
    getDeviceSessionById: vi.fn(),
    getDeviceSessionByDeviceId: vi.fn(),
    removeDeviceSession: vi.fn(),
    getDeviceSessions: getDeviceSessionsMock,
    sessionsObs: vi.fn(),
  } as unknown as DeviceSessionService;

  const mockManagerApiDataSource: ManagerApiDataSource = {
    setProvider: vi.fn(),
  } as unknown as ManagerApiDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    getDeviceSessionsMock.mockReturnValue([
      {
        getDeviceSessionState: getDeviceSessionStateMock,
        setDeviceSessionState: setDeviceSessionStateMock,
      } as unknown as DeviceSession,
    ]);
  });

  it("should call setProvider on ManagerApiDataSource with the correct provider", () => {
    // GIVEN
    const useCase = new SetProviderUseCase(
      mockDeviceSession,
      mockManagerApiDataSource,
    );
    const provider = 123;
    getDeviceSessionStateMock.mockReturnValue({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
    } as DeviceSessionState);

    // WHEN
    useCase.execute(provider);

    // THEN
    expect(mockManagerApiDataSource.setProvider).toHaveBeenCalledWith(provider);
    expect(setDeviceSessionStateMock).not.toHaveBeenCalled();
  });

  it("should clean the device session", () => {
    // GIVEN
    const useCase = new SetProviderUseCase(
      mockDeviceSession,
      mockManagerApiDataSource,
    );
    const provider = 123;
    getDeviceSessionStateMock.mockReturnValue({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareVersion: "firmwareVersion" as unknown as FirmwareVersion,
      firmwareUpdateContext:
        "firmwareUpdateContext" as unknown as FirmwareUpdateContext,
      installedApps: "apps" as unknown as Application[],
      appsUpdates: "appsUpdate" as unknown as Application[],
      catalog: "catalog" as unknown as Catalog,
    } as DeviceSessionState);

    // WHEN
    useCase.execute(provider);

    // THEN
    expect(mockManagerApiDataSource.setProvider).toHaveBeenCalledWith(provider);
    expect(setDeviceSessionStateMock).toHaveBeenCalledWith({
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      firmwareVersion: "firmwareVersion" as unknown as FirmwareVersion,
      firmwareUpdateContext: undefined,
      installedApps: [],
      appsUpdates: undefined,
      catalog: undefined,
    });
  });
});
