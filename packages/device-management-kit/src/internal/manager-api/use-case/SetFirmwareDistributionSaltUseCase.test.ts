import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeviceStatus } from "@api/device/DeviceStatus";
import {
  type Catalog,
  type DeviceSessionState,
  DeviceSessionStateType,
  type FirmwareUpdateContext,
  type FirmwareVersion,
} from "@api/device-session/DeviceSessionState";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import { type DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { type Application } from "@internal/manager-api/model/Application";

import { SetFirmwareDistributionSaltUseCase } from "./SetFirmwareDistributionSaltUseCase";

const readyState = {
  sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
  deviceStatus: DeviceStatus.CONNECTED,
  firmwareVersion: "firmwareVersion" as unknown as FirmwareVersion,
  firmwareUpdateContext:
    "firmwareUpdateContext" as unknown as FirmwareUpdateContext,
  installedApps: "apps" as unknown as Application[],
  appsUpdates: "appsUpdates" as unknown as Application[],
  catalog: "catalog" as unknown as Catalog,
} as DeviceSessionState;

const connectedState = {
  sessionStateType: DeviceSessionStateType.Connected,
  deviceStatus: DeviceStatus.CONNECTED,
} as DeviceSessionState;

describe("SetFirmwareDistributionSaltUseCase", () => {
  const getDeviceSessionsMock = vi.fn();
  const sessionService = {
    getDeviceSessions: getDeviceSessionsMock,
  } as unknown as DeviceSessionService;

  const getFirmwareDistributionSaltMock = vi.fn();
  const setFirmwareDistributionSaltMock = vi.fn();
  const managerApiDataSource = {
    getFirmwareDistributionSalt: getFirmwareDistributionSaltMock,
    setFirmwareDistributionSalt: setFirmwareDistributionSaltMock,
  } as unknown as ManagerApiDataSource;

  let logger: LoggerPublisherService;
  let useCase: SetFirmwareDistributionSaltUseCase;

  const makeSession = (state: DeviceSessionState) =>
    ({
      getDeviceSessionState: vi.fn().mockReturnValue(state),
      setDeviceSessionState: vi.fn(),
    }) as unknown as DeviceSession;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new DefaultLoggerPublisherService(
      [],
      "SetFirmwareDistributionSaltUseCaseTest",
    );
    vi.spyOn(logger, "info");
    vi.spyOn(logger, "warn");
    vi.spyOn(logger, "debug");
    getFirmwareDistributionSaltMock.mockReturnValue("previous-salt");
    getDeviceSessionsMock.mockReturnValue([]);
    useCase = new SetFirmwareDistributionSaltUseCase(
      sessionService,
      managerApiDataSource,
      () => logger,
    );
  });

  it("should set the salt on the data source and log the change", () => {
    // WHEN
    useCase.execute("new-salt");

    // THEN
    expect(setFirmwareDistributionSaltMock).toHaveBeenCalledWith("new-salt");
    expect(logger.info).toHaveBeenCalledWith(
      "Firmware distribution salt updated",
      {
        data: {
          previousSalt: "previous-salt",
          salt: "new-salt",
          invalidatedSessions: 0,
        },
      },
    );
  });

  it("should only invalidate ready sessions with a cached firmware update context", () => {
    // GIVEN
    const readySession = makeSession(readyState);
    const readySessionWithoutContext = makeSession({
      ...readyState,
      firmwareUpdateContext: undefined,
    } as DeviceSessionState);
    const connectedSession = makeSession(connectedState);
    getDeviceSessionsMock.mockReturnValue([
      readySession,
      readySessionWithoutContext,
      connectedSession,
    ]);

    // WHEN
    useCase.execute("new-salt");

    // THEN
    expect(readySession.setDeviceSessionState).toHaveBeenCalledWith({
      ...readyState,
      firmwareUpdateContext: undefined,
    });
    expect(
      readySessionWithoutContext.setDeviceSessionState,
    ).not.toHaveBeenCalled();
    expect(connectedSession.setDeviceSessionState).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Firmware distribution salt updated",
      {
        data: {
          previousSalt: "previous-salt",
          salt: "new-salt",
          invalidatedSessions: 1,
        },
      },
    );
  });

  it("should set the salt before invalidating the sessions", () => {
    // GIVEN
    const readySession = makeSession(readyState);
    getDeviceSessionsMock.mockReturnValue([readySession]);

    // WHEN
    useCase.execute("new-salt");

    // THEN
    expect(
      setFirmwareDistributionSaltMock.mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(readySession.setDeviceSessionState).mock
        .invocationCallOrder[0]!,
    );
  });

  it("should do nothing if the salt is unchanged", () => {
    // GIVEN
    const readySession = makeSession(readyState);
    getDeviceSessionsMock.mockReturnValue([readySession]);

    // WHEN
    useCase.execute("previous-salt");

    // THEN
    expect(setFirmwareDistributionSaltMock).not.toHaveBeenCalled();
    expect(readySession.setDeviceSessionState).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      "Firmware distribution salt unchanged",
      { data: { salt: "previous-salt" } },
    );
  });

  it.each(["", "   "])(
    "should ignore an empty salt (%j) and log a warning",
    (salt) => {
      // GIVEN
      const readySession = makeSession(readyState);
      getDeviceSessionsMock.mockReturnValue([readySession]);

      // WHEN
      useCase.execute(salt);

      // THEN
      expect(setFirmwareDistributionSaltMock).not.toHaveBeenCalled();
      expect(readySession.setDeviceSessionState).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Ignoring empty firmware distribution salt",
      );
    },
  );
});
