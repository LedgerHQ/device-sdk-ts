import { Either, Left } from "purify-ts";
import { Observable } from "rxjs";

import { type DmkConfig } from "@api/DmkConfig";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS } from "@internal/device-session/data/DeviceSessionRefresherConst";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import { DefaultDeviceSessionService } from "./DefaultDeviceSessionService";

vi.mock("@internal/logger-publisher/service/DefaultLoggerPublisherService");
vi.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let sessionService: DefaultDeviceSessionService;
let loggerService: DefaultLoggerPublisherService;
let deviceSession: DeviceSession;
let deviceSession1: DeviceSession;
let deviceSession2: DeviceSession;
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;

describe("DefaultDeviceSessionService", () => {
  // Initialize shared resources
  loggerService = new DefaultLoggerPublisherService([], "deviceSession");
  managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
  managerApi = new DefaultManagerApiService(managerApiDataSource);
  secureChannelDataSource = new DefaultSecureChannelDataSource({} as DmkConfig);
  secureChannel = new DefaultSecureChannelService(secureChannelDataSource);

  beforeEach(() => {
    vi.restoreAllMocks();
    // Create a new instance before each test
    sessionService = new DefaultDeviceSessionService(() => loggerService);
    // Create a device session stub with default properties
    deviceSession = deviceSessionStubBuilder(
      {},
      () => loggerService,
      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
  });

  afterEach(() => {
    deviceSession.close();
  });

  it("should have an empty DeviceSession list", () => {
    expect(sessionService.getDeviceSessions()).toEqual([]);
  });

  describe("DeviceSessionService addDeviceSession", () => {
    it("should add a DeviceSession if it does not already exist", () => {
      sessionService.addDeviceSession(deviceSession);
      expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
    });
    it("should not add a DeviceSession if it already exists", () => {
      sessionService.addDeviceSession(deviceSession);
      sessionService.addDeviceSession(deviceSession);
      expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
    });
  });

  describe("DeviceSessionService removeDeviceSession", () => {
    it("should remove the DeviceSession of given ID", () => {
      sessionService.addDeviceSession(deviceSession);
      sessionService.removeDeviceSession(deviceSession.id);
      expect(sessionService.getDeviceSessions()).toEqual([]);
    });
    it("should not remove the DeviceSession of given ID if it does not exist", () => {
      sessionService.addDeviceSession(deviceSession);
      sessionService.removeDeviceSession("non-existent-id");
      expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
    });
  });

  describe("DeviceSessionService getDeviceSessionById", () => {
    it("should get the DeviceSession of given ID if it exists", () => {
      sessionService.addDeviceSession(deviceSession);
      expect(sessionService.getDeviceSessionById(deviceSession.id)).toEqual(
        Either.of(deviceSession),
      );
    });
    it("should not get the DeviceSession if it does not exist", () => {
      sessionService.addDeviceSession(deviceSession);
      expect(sessionService.getDeviceSessionById("non-existent-id")).toEqual(
        Left(new DeviceSessionNotFound()),
      );
    });
  });

  describe("DeviceSessionService getDeviceSessionsByDeviceId", () => {
    it("should not get device sessions by deviceId if none exist", () => {
      sessionService.addDeviceSession(deviceSession);
      expect(
        sessionService.getDeviceSessionsByDeviceId("non-existent-device-id"),
      ).toEqual(Left(new DeviceSessionNotFound()));
    });
    it("should get a single device session by deviceId", () => {
      sessionService.addDeviceSession(deviceSession);
      expect(
        sessionService.getDeviceSessionsByDeviceId(
          deviceSession.connectedDevice.id,
        ),
      ).toEqual(Either.of([deviceSession]));
    });
    it("should get device sessions by deviceId", () => {
      sessionService.addDeviceSession(deviceSession);
      deviceSession1 = deviceSessionStubBuilder(
        {
          connectedDevice: connectedDeviceStubBuilder({ id: "device-1" }),
          id: "session-1",
        },
        () => loggerService,
        managerApi,
        secureChannel,
        DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
      );

      deviceSession2 = deviceSessionStubBuilder(
        {
          connectedDevice: connectedDeviceStubBuilder({ id: "device-1" }),
          id: "session-2",
        },
        () => loggerService,
        managerApi,
        secureChannel,
        DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
      );
      sessionService.addDeviceSession(deviceSession1);
      sessionService.addDeviceSession(deviceSession2);
      expect(sessionService.getDeviceSessionsByDeviceId("device-1")).toEqual(
        Either.of([deviceSession1, deviceSession2]),
      );
      deviceSession1.close();
      deviceSession2.close();
    });
  });

  it("should get all sessions", () => {
    sessionService.addDeviceSession(deviceSession);
    expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
  });

  it("should retrieve sessionObs", () => {
    expect(sessionService.sessionsObs).toBeInstanceOf(
      Observable<DeviceSession>,
    );
  });

  it("should emit new session", () =>
    new Promise<void>((resolve, reject) => {
      const subscription = sessionService.sessionsObs.subscribe({
        next(emittedDeviceSession) {
          try {
            expect(emittedDeviceSession).toStrictEqual(deviceSession);
            subscription.unsubscribe();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      });
      sessionService.addDeviceSession(deviceSession);
    }));

  it("should emit previous added session", () => {
    const lastDeviceSession = deviceSessionStubBuilder(
      { id: "last-session" },
      () => loggerService,
      managerApi,
      secureChannel,
      DEVICE_SESSION_REFRESHER_DEFAULT_OPTIONS,
    );
    const emittedSessions: DeviceSession[] = [];
    sessionService.addDeviceSession(deviceSession);
    sessionService.addDeviceSession(lastDeviceSession);

    const subscription = sessionService.sessionsObs.subscribe({
      next(emittedDeviceSession) {
        emittedSessions.push(emittedDeviceSession);
      },
    });
    lastDeviceSession.close();
    expect(emittedSessions).toEqual([deviceSession, lastDeviceSession]);
    subscription.unsubscribe();
  });
});
