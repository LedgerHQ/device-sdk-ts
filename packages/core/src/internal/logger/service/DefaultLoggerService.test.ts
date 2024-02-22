import { LogLevel } from "@api/index";
import { ConsoleLogger } from "@api/logger-subscriber/service/ConsoleLogger";

import { DefaultLoggerService } from "./DefaultLoggerService";

jest.mock("../../../api/logger-subscriber/service/ConsoleLogger");

let service: DefaultLoggerService;
let subscriber: jest.Mocked<ConsoleLogger>;
const message = "message";
const options = { data: { key: "value" } };

describe("LoggerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriber = new ConsoleLogger() as jest.Mocked<ConsoleLogger>;
    service = new DefaultLoggerService([subscriber]);
  });

  it("should call subscriber.log with the correct log object", () => {
    service.info(message, options);
    expect(subscriber.log).toHaveBeenCalledWith(
      LogLevel.Info,
      message,
      options,
    );
  });

  describe("info", () => {
    it("should call _log with the correct LogLevel", () => {
      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.info(message, options);
      expect(spy).toHaveBeenCalledWith(LogLevel.Info, message, options);
      spy.mockRestore();
    });
  });

  describe("debug", () => {
    it("should have the correct LogLevel", () => {
      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.debug(message, options);
      expect(spy).toHaveBeenCalledWith(LogLevel.Debug, message, options);
      spy.mockRestore();
    });
  });

  describe("warn", () => {
    it("should have the correct LogLevel", () => {
      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.warn(message, options);
      expect(spy).toHaveBeenCalledWith(LogLevel.Warning, message, options);
      spy.mockRestore();
    });
  });

  describe("error", () => {
    it("should have the correct LogLevel", () => {
      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.error(message, options);
      expect(spy).toHaveBeenCalledWith(LogLevel.Error, message, options);
      spy.mockRestore();
    });
  });
});
