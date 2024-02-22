import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogOptions } from "@api/logger-subscriber/model/LogOptions";

import { ConsoleLogger } from "./ConsoleLogger";

const warn = jest.spyOn(console, "warn").mockImplementation(jest.fn());
const info = jest.spyOn(console, "info").mockImplementation(jest.fn());
const debug = jest.spyOn(console, "debug").mockImplementation(jest.fn());
const error = jest.spyOn(console, "error").mockImplementation(jest.fn());
const log = jest.spyOn(console, "log").mockImplementation(jest.fn());

let logger: ConsoleLogger;
const options: LogOptions = { data: { key: "value" } };
const message = "message";

describe("ConsoleLogger", () => {
  describe("log", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("should log Info level", () => {
      logger.log(LogLevel.Info, message, options);
      expect(info).toHaveBeenCalledWith("[logger]", message);
    });

    it("should log Info level with a custom tag", () => {
      const tag = "custom-tag";
      logger.log(LogLevel.Info, message, { ...options, tag });
      expect(info).toHaveBeenCalledWith(`[${tag}]`, message);
    });

    it("should log Warn level", () => {
      logger.log(LogLevel.Warning, message, options);
      expect(warn).toHaveBeenCalledWith("[logger]", message);
    });

    it("should log Debug level", () => {
      logger.log(LogLevel.Debug, message, options);
      expect(debug).toHaveBeenCalledWith("[logger]", message);
    });

    it("should default to Log level if none present", () => {
      logger.log(LogLevel.Fatal, message, options);
      expect(log).toHaveBeenCalledWith("[logger]", message);
    });

    it("should log Error level", () => {
      logger.log(LogLevel.Error, message, options);
      expect(error).toHaveBeenCalledWith("[logger]", message);
    });
  });
});
