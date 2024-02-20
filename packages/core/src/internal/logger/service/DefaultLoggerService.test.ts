import { ConsoleLogger } from "../../../api/ConsoleLogger";
import { DefaultLoggerService } from "./DefaultLoggerService";
import { LogLevel } from "./Log";
import { LogBuilder } from "./LogBuilder";

jest.mock("../../../api/ConsoleLogger");

let service: DefaultLoggerService;

let subscriber: jest.Mocked<ConsoleLogger>;

describe("LoggerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriber = new ConsoleLogger() as jest.Mocked<ConsoleLogger>;
    service = new DefaultLoggerService([subscriber]);
  });

  it("should call subscriber.log with the correct log object", () => {
    const log = LogBuilder.build({ type: "test" }, { key: "value" }, "message");
    service.info(log);
    expect(subscriber.log).toHaveBeenCalledWith(LogLevel.Info, log);
  });

  describe("info", () => {
    it("should call _log with the correct LogLevel", () => {
      const log = LogBuilder.build(
        { type: "test" },
        { key: "value" },
        "message",
      );

      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.info(log);
      expect(spy).toHaveBeenCalledWith(LogLevel.Info, log);
      spy.mockRestore();
    });
  });

  describe("debug", () => {
    it("should have the correct LogLevel", () => {
      const log = LogBuilder.build(
        { type: "test" },
        { key: "value" },
        "message",
      );

      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.debug(log);
      expect(spy).toHaveBeenCalledWith(LogLevel.Debug, log);
      spy.mockRestore();
    });
  });

  describe("warn", () => {
    it("should have the correct LogLevel", () => {
      const log = LogBuilder.build(
        { type: "test" },
        { key: "value" },
        "message",
      );

      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.warn(log);
      expect(spy).toHaveBeenCalledWith(LogLevel.Warning, log);
      spy.mockRestore();
    });
  });

  describe("error", () => {
    it("should have the correct LogLevel", () => {
      const log = LogBuilder.buildFromError(
        new Error("test"),
        { type: "test" },
        { key: "value" },
      );

      const spy = jest.spyOn(service, "_log").mockImplementation(jest.fn());

      service.error(log);
      expect(spy).toHaveBeenCalledWith(LogLevel.Error, log);
      spy.mockRestore();
    });
  });
});
