import { Either, Left } from "purify-ts";
import { Observable } from "rxjs";

import { type DmkConfig } from "@api/DmkConfig";
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
let managerApiDataSource: ManagerApiDataSource;
let managerApi: ManagerApiService;
let secureChannelDataSource: SecureChannelDataSource;
let secureChannel: SecureChannelService;

describe("DefaultDeviceSessionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    loggerService = new DefaultLoggerPublisherService([], "deviceSession");
    sessionService = new DefaultDeviceSessionService(() => loggerService);
    managerApiDataSource = new AxiosManagerApiDataSource({} as DmkConfig);
    managerApi = new DefaultManagerApiService(managerApiDataSource);
    secureChannelDataSource = new DefaultSecureChannelDataSource(
      {} as DmkConfig,
    );
    secureChannel = new DefaultSecureChannelService(secureChannelDataSource);

    deviceSession = deviceSessionStubBuilder(
      {},
      () => loggerService,
      managerApi,
      secureChannel,
    );
  });

  afterEach(() => {
    deviceSession.close();
  });

  it("should have an empty sessions list", () => {
    expect(sessionService.getDeviceSessions()).toEqual([]);
  });

  it("should add a deviceSession", () => {
    sessionService.addDeviceSession(deviceSession);
    expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
  });

  it("should not add a deviceSession if it already exists", () => {
    sessionService.addDeviceSession(deviceSession);
    sessionService.addDeviceSession(deviceSession);
    expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
  });

  it("should remove a deviceSession", () => {
    sessionService.addDeviceSession(deviceSession);
    sessionService.removeDeviceSession(deviceSession.id);
    expect(sessionService.getDeviceSessions()).toEqual([]);
  });

  it("should not remove a deviceSession if it does not exist", () => {
    sessionService.removeDeviceSession(deviceSession.id);
    expect(sessionService.getDeviceSessions()).toEqual([]);
  });

  it("should get a deviceSession", () => {
    sessionService.addDeviceSession(deviceSession);
    expect(sessionService.getDeviceSessionById(deviceSession.id)).toEqual(
      Either.of(deviceSession),
    );
  });

  it("should not get a deviceSession if it does not exist", () => {
    expect(sessionService.getDeviceSessionById(deviceSession.id)).toEqual(
      Left(new DeviceSessionNotFound()),
    );
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
