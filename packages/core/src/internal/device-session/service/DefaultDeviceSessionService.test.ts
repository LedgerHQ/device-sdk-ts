import { Either, Left } from "purify-ts";

import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { connectedDeviceStubBuilder } from "@internal/usb/model/InternalConnectedDevice.stub";

import { DefaultDeviceSessionService } from "./DefaultDeviceSessionService";

jest.mock("@internal/logger-publisher/service/DefaultLoggerPublisherService");

let sessionService: DefaultDeviceSessionService;
let loggerService: DefaultLoggerPublisherService;
let deviceSession: DeviceSession;
describe("DefaultDeviceSessionService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    loggerService = new DefaultLoggerPublisherService([], "deviceSession");
    sessionService = new DefaultDeviceSessionService(() => loggerService);
    deviceSession = new DeviceSession(
      {
        connectedDevice: connectedDeviceStubBuilder(),
      },
      () => loggerService,
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
