import { LogLevel, LogOptions } from "@internal/logger/service/Log";

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
      expect(info).toHaveBeenCalledWith("[LOGGER]", message);
    });

    it("should log Warn level", () => {
      logger.log(LogLevel.Warning, message, options);
      expect(warn).toHaveBeenCalledWith("[LOGGER]", message);
    });

    it("should log Debug level", () => {
      logger.log(LogLevel.Debug, message, options);
      expect(debug).toHaveBeenCalledWith("[LOGGER]", message);
    });

    it("should default to Log level if none present", () => {
      logger.log(LogLevel.Fatal, message, options);
      expect(log).toHaveBeenCalledWith("[LOGGER]", message);
    });

    it("should log Error level", () => {
      logger.log(LogLevel.Error, message, options);
      expect(error).toHaveBeenCalledWith("[LOGGER]", message);
    });
  });
});
