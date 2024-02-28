import { Either, Left } from "purify-ts";

import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { Session } from "@internal/device-session/model/Session";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { DefaultSessionService } from "./DefaultSessionService";

jest.mock("@internal/logger-publisher/service/DefaultLoggerPublisherService");

let sessionService: DefaultSessionService;
let loggerService: DefaultLoggerPublisherService;
let session: Session;
describe("DefaultSessionService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    session = {
      id: "123",
      sendApdu: jest.fn(),
    };
    loggerService = new DefaultLoggerPublisherService([], "session");
    sessionService = new DefaultSessionService(() => loggerService, []);
  });

  it("should have an empty sessions list", () => {
    expect(sessionService.getSessions()).toEqual([]);
  });

  it("should add a session", () => {
    sessionService.addSession(session);
    expect(sessionService.getSessions()).toEqual([session]);
  });

  it("should not add a session if it already exists", () => {
    sessionService.addSession(session);
    sessionService.addSession(session);
    expect(sessionService.getSessions()).toEqual([session]);
  });

  it("should remove a session", () => {
    sessionService.addSession(session);
    sessionService.removeSession(session.id);
    expect(sessionService.getSessions()).toEqual([]);
  });

  it("should not remove a session if it does not exist", () => {
    sessionService.removeSession(session.id);
    expect(sessionService.getSessions()).toEqual([]);
  });

  it("should get a session", () => {
    sessionService.addSession(session);
    expect(sessionService.getSession(session.id)).toEqual(Either.of(session));
  });

  it("should not get a session if it does not exist", () => {
    expect(sessionService.getSession(session.id)).toEqual(
      Left(new DeviceSessionNotFound()),
    );
  });

  it("should get all sessions", () => {
    sessionService.addSession(session);
    expect(sessionService.getSessions()).toEqual([session]);
  });
});
