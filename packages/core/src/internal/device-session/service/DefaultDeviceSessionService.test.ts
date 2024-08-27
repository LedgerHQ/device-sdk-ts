import { Either, Left } from "purify-ts";

import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
import type { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { connectedDeviceStubBuilder } from "@internal/transport/model/InternalConnectedDevice.stub";

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

    deviceSession = new DeviceSession(
      {
        connectedDevice: connectedDeviceStubBuilder(),
      },
      () => loggerService,
      managerApi,
    );
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
});
