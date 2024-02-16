import { LogBuilder } from "@internal/logger/service/LogBuilder";

import { ConsoleLogger, Log, LogLevel } from "./ConsoleLogger";

const warn = jest.spyOn(console, "warn").mockImplementation(jest.fn());
const info = jest.spyOn(console, "info").mockImplementation(jest.fn());
const debug = jest.spyOn(console, "debug").mockImplementation(jest.fn());
const error = jest.spyOn(console, "error").mockImplementation(jest.fn());
const log = jest.spyOn(console, "log").mockImplementation(jest.fn());

class CustomError {
  _tag = "CustomError";
  originalError?: Error;
  constructor(originalError?: Error) {
    this.originalError = originalError;
  }
}

let logger: ConsoleLogger;
let logObject: Log;
describe("ConsoleLogger", () => {
  describe("exports", () => {
    it("Log", () => {
      const lgg = new Log({
        messages: [],
        data: {},
        context: {},
      });
      expect(lgg).toBeInstanceOf(Log);
    });
  });

  describe("log", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger();
      logObject = LogBuilder.build({}, {}, "test");
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it("should log Info level", () => {
      logger.log(LogLevel.Info, logObject);
      expect(info).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    it("should log Warn level", () => {
      logger.log(LogLevel.Warning, logObject);
      expect(warn).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    it("should log Debug level", () => {
      logger.log(LogLevel.Debug, logObject);
      expect(debug).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    it("should default to Log level if none present", () => {
      // @ts-expect-error disable for tests
      logger.log(null, logObject);
      expect(log).toHaveBeenCalledWith("[LOGGER]", "test");
    });

    describe("error", () => {
      it("should log Error level", () => {
        const err = new Error("test");
        logObject = LogBuilder.buildFromError(err);
        logger.log(LogLevel.Error, logObject);
        expect(warn).toHaveBeenCalledWith("[LOGGER]", "test");
        expect(error).toHaveBeenCalledWith(err);
      });

      it("should log Error level with custom error and original error", () => {
        const originalError = new Error("test error");
        const err = new CustomError(originalError);
        logObject = LogBuilder.buildFromError(err);
        logger.log(LogLevel.Error, logObject);
        expect(logObject.context.tag).toBe("CustomError");
        expect(warn).toHaveBeenCalledWith("[LOGGER]", "test error");
        expect(error).toHaveBeenCalledWith(originalError);
      });

      it("should log Error level with custom error and no original error", () => {
        const err = new CustomError();
        logObject = LogBuilder.buildFromError(err);
        logger.log(LogLevel.Error, logObject);
        expect(logObject.context.tag).toBe("CustomError");
        expect(warn).toHaveBeenCalledWith("[LOGGER]", "CustomError");
        expect(error).toHaveBeenCalledWith(err);
      });

      it("should log Warn level if no error type in context", () => {
        logObject = LogBuilder.build({ type: "test" }, {}, "test");
        logger.log(LogLevel.Error, logObject);
        expect(warn).toHaveBeenCalledWith(
          "[LOGGER]",
          "[type !== 'error']",
          "test",
        );
      });
    });
  });
});
