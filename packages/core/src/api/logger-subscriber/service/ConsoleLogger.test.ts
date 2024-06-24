import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

import { ConsoleLogger } from "./ConsoleLogger";

const warn = jest.spyOn(console, "warn").mockImplementation(jest.fn());
const info = jest.spyOn(console, "info").mockImplementation(jest.fn());
const debug = jest.spyOn(console, "debug").mockImplementation(jest.fn());
const error = jest.spyOn(console, "error").mockImplementation(jest.fn());
const log = jest.spyOn(console, "log").mockImplementation(jest.fn());

let logger: ConsoleLogger;
const options: LogSubscriberOptions = {
  data: { key: "value" },
  timestamp: 1,
  tag: "tag",
};
const message = "message";

describe("ConsoleLogger", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("default level (LogLevel.DEBUG)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger();
    });

    describe("log", () => {
      it("should log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Info level with a custom tag", () => {
        const tag = "custom-tag";
        logger.log(LogLevel.Info, message, { ...options, tag });
        expect(info).toHaveBeenCalledWith(`[${tag}]`, message, options.data);
      });

      it("should log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });
    });
  });

  describe("custom level (LogLevel.Info)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Info);
    });

    describe("log", () => {
      it("should log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Info level with a custom tag", () => {
        const tag = "custom-tag";
        logger.log(LogLevel.Info, message, { ...options, tag });
        expect(info).toHaveBeenCalledWith(`[${tag}]`, message, options.data);
      });

      it("should log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should not log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).not.toHaveBeenCalled();
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });
    });
  });

  describe("custom level (LogLevel.Warning)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Warning);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should not log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).not.toHaveBeenCalled();
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });
    });
  });

  describe("custom level (LogLevel.Error)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Error);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should not log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).not.toHaveBeenCalled();
      });

      it("should not log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).not.toHaveBeenCalled();
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });
    });
  });

  describe("custom level (LogLevel.Fatal)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Fatal);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should not log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).not.toHaveBeenCalled();
      });

      it("should not log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).not.toHaveBeenCalled();
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(
          `[${options.tag}]`,
          message,
          options.data,
        );
      });
    });
  });
});
