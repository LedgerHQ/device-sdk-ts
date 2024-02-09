import { LogBuilder } from "@internal/logger/service/LogBuilder";

import { ConsoleLogger, Log, LogLevel } from "./Logger";

const warn = jest.spyOn(console, "warn").mockImplementation(jest.fn());
const info = jest.spyOn(console, "info").mockImplementation(jest.fn());
const debug = jest.spyOn(console, "debug").mockImplementation(jest.fn());
const error = jest.spyOn(console, "error").mockImplementation(jest.fn());
const log = jest.spyOn(console, "log").mockImplementation(jest.fn());

let logger: ConsoleLogger;
let logObject: Log;
describe("ConsoleLogger", () => {
  beforeEach(() => {
    logger = new ConsoleLogger();
    logObject = LogBuilder.build({}, {}, "test");
  });

  afterAll(() => {
    warn.mockRestore();
    info.mockRestore();
    debug.mockRestore();
    error.mockRestore();
    log.mockRestore();
  });

  describe("log", () => {
    it("should log Info level", () => {
      logObject.setLevel(LogLevel.Info);
      logger.log(logObject);
      expect(info).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    it("should log Warn level", () => {
      logObject.setLevel(LogLevel.Warning);
      logger.log(logObject);
      expect(warn).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    it("should log Error level", () => {
      logObject.setLevel(LogLevel.Error);
      logObject.addMessage("error");
      logger.log(logObject);
      expect(error).toHaveBeenCalledWith("[LOGGER]", "test", "error");
    });

    it("should log Debug level", () => {
      logObject.setLevel(LogLevel.Debug);
      logger.log(logObject);
      expect(debug).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    it("should default to Log level if none present", () => {
      // @ts-expect-error disable for tests
      logObject.setLevel(undefined);
      logger.log(logObject);
      expect(log).toHaveBeenCalledWith("[LOGGER]", "test");
    });
  });
});
