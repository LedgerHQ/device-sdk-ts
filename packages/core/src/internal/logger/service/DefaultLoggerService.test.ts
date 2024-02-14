import { DefaultLoggerService } from "./DefaultLoggerService";
import { LogLevel } from "./Log";
import { LogBuilder } from "./LogBuilder";

let service: DefaultLoggerService;

const subscriber = {
  log: jest.fn(),
};

describe("LoggerService", () => {
  it("should call subscriber.log with the correct log object", () => {
    subscriber.log.mockClear();
    service = new DefaultLoggerService([subscriber]);
    const log = LogBuilder.build({ type: "test" }, { key: "value" }, "message");

    service.info(log);
    expect(subscriber.log).toHaveBeenCalledWith(LogLevel.Info, log);
  });

  describe("info", () => {
    it("should call _log with the correct LogLevel", () => {
      subscriber.log.mockClear();
      service = new DefaultLoggerService([subscriber]);
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
      subscriber.log.mockClear();
      service = new DefaultLoggerService([subscriber]);
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
      subscriber.log.mockClear();
      service = new DefaultLoggerService([subscriber]);
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
      subscriber.log.mockClear();
      service = new DefaultLoggerService([subscriber]);
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
