import { DefaultLoggerService } from "./DefaultLoggerService";
import { LogLevel } from "./Log";
import { LogBuilder } from "./LogBuilder";
import { LoggerService } from "./LoggerService";

let service: LoggerService;

const subscriber = {
  log: jest.fn(),
};

describe("LoggerService", () => {
  it("should call subscriber.log with the correct log object", () => {
    subscriber.log.mockClear();
    service = new DefaultLoggerService([subscriber]);
    const log = LogBuilder.build({ type: "test" }, { key: "value" }, "message");

    service.info(log);

    expect(subscriber.log).toHaveBeenCalledWith(log);
  });

  describe("info", () => {
    it("should have the correct LogLevel", () => {
      subscriber.log.mockClear();
      service = new DefaultLoggerService([subscriber]);
      const log = LogBuilder.build(
        { type: "test" },
        { key: "value" },
        "message",
      );

      service.info(log);

      expect(log.level).toBe(LogLevel.Info);
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

      service.debug(log);

      expect(log.level).toBe(LogLevel.Debug);
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

      service.warn(log);

      expect(log.level).toBe(LogLevel.Warning);
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

      service.error(log);

      expect(log.level).toBe(LogLevel.Error);
    });
  });
});
