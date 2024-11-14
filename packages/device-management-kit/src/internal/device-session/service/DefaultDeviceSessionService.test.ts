import { Either, Left } from "purify-ts";
import { Observable } from "rxjs";

import { type DeviceSession } from "@internal/device-session/model/DeviceSession";
import { deviceSessionStubBuilder } from "@internal/device-session/model/DeviceSession.stub";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

import { DefaultDeviceSessionService } from "./DefaultDeviceSessionService";

jest.mock("@internal/logger-publisher/service/DefaultLoggerPublisherService");
jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");

let sessionService: DefaultDeviceSessionService;
let loggerService: DefaultLoggerPublisherService;
let deviceSession: DeviceSession;
let managerApi: ManagerApiService;
let managerApiDataSource: ManagerApiDataSource;
describe("DefaultDeviceSessionService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    loggerService = new DefaultLoggerPublisherService([], "deviceSession");
    sessionService = new DefaultDeviceSessionService(() => loggerService);
    managerApiDataSource = new AxiosManagerApiDataSource({
      managerApiUrl: "http://fake.url",
      mockUrl: "http://fake-mock.url",
    });
    managerApi = new DefaultManagerApiService(managerApiDataSource);

    deviceSession = deviceSessionStubBuilder(
      {},
      () => loggerService,
      managerApi,
    );
  });

  it("should have an empty sessions list", () => {
    expect(sessionService.getDeviceSessions()).toEqual([]);
    deviceSession.close();
  });

  it("should add a deviceSession", () => {
    sessionService.addDeviceSession(deviceSession);
    deviceSession.close();
    expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
  });

  it("should not add a deviceSession if it already exists", () => {
    sessionService.addDeviceSession(deviceSession);
    sessionService.addDeviceSession(deviceSession);
    deviceSession.close();
    expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
  });

  it("should remove a deviceSession", () => {
    sessionService.addDeviceSession(deviceSession);
    deviceSession.close();
    sessionService.removeDeviceSession(deviceSession.id);
    expect(sessionService.getDeviceSessions()).toEqual([]);
  });

  it("should not remove a deviceSession if it does not exist", () => {
    deviceSession.close();
    sessionService.removeDeviceSession(deviceSession.id);
    expect(sessionService.getDeviceSessions()).toEqual([]);
  });

  it("should get a deviceSession", () => {
    sessionService.addDeviceSession(deviceSession);
    deviceSession.close();
    expect(sessionService.getDeviceSessionById(deviceSession.id)).toEqual(
      Either.of(deviceSession),
    );
  });

  it("should not get a deviceSession if it does not exist", () => {
    deviceSession.close();
    expect(sessionService.getDeviceSessionById(deviceSession.id)).toEqual(
      Left(new DeviceSessionNotFound()),
    );
  });

  it("should get all sessions", () => {
    sessionService.addDeviceSession(deviceSession);
    deviceSession.close();
    expect(sessionService.getDeviceSessions()).toEqual([deviceSession]);
  });

  it("should retrieve sessionObs", () => {
    expect(sessionService.sessionsObs).toBeInstanceOf(
      Observable<DeviceSession>,
    );
    deviceSession.close();
  });

  it("should emit new session", (done) => {
    const subscription = sessionService.sessionsObs.subscribe({
      next(emittedDeviceSession) {
        expect(emittedDeviceSession).toStrictEqual(deviceSession);
        subscription.unsubscribe();
        done();
      },
    });
    sessionService.addDeviceSession(deviceSession);
    deviceSession.close();
  });

  it("should emit previous added session", () => {
    const lastDeviceSession = deviceSessionStubBuilder(
      { id: "last-session" },
      () => loggerService,
      managerApi,
    );
    const emittedSessions: DeviceSession[] = [];
    sessionService.addDeviceSession(deviceSession);
    sessionService.addDeviceSession(lastDeviceSession);

    const subscription = sessionService.sessionsObs.subscribe({
      next(emittedDeviceSession) {
        emittedSessions.push(emittedDeviceSession);
      },
    });
    deviceSession.close();
    lastDeviceSession.close();
    expect(emittedSessions).toEqual([deviceSession, lastDeviceSession]);
    subscription.unsubscribe();
  });
});
