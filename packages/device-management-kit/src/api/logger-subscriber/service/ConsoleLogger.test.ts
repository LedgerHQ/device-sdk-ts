import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { type LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

import { ConsoleLogger } from "./ConsoleLogger";

const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
const info = vi.spyOn(console, "info").mockImplementation(vi.fn());
const debug = vi.spyOn(console, "debug").mockImplementation(vi.fn());
const error = vi.spyOn(console, "error").mockImplementation(vi.fn());
const log = vi.spyOn(console, "log").mockImplementation(vi.fn());

let logger: ConsoleLogger;
// Tags are pre-formatted by the publisher before reaching subscribers
const options: LogSubscriberOptions = {
  data: { key: "value" },
  timestamp: 1,
  tag: "[tag]",
};
const message = "message";

describe("ConsoleLogger", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("default level (LogLevel.DEBUG)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      logger = new ConsoleLogger();
    });

    describe("log", () => {
      it("should log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Info level with a custom tag", () => {
        const tag = "[custom-tag]";
        logger.log(LogLevel.Info, message, { ...options, tag });
        expect(info).toHaveBeenCalledWith(tag, message, options.data);
      });

      it("should log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });
    });
  });

  describe("custom level (LogLevel.Info)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Info);
    });

    describe("log", () => {
      it("should log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Info level with a custom tag", () => {
        const tag = "[custom-tag]";
        logger.log(LogLevel.Info, message, { ...options, tag });
        expect(info).toHaveBeenCalledWith(tag, message, options.data);
      });

      it("should log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should not log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).not.toHaveBeenCalled();
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });
    });
  });

  describe("custom level (LogLevel.Warning)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Warning);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should log Warn level", () => {
        logger.log(LogLevel.Warning, message, options);
        expect(warn).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should not log Debug level", () => {
        logger.log(LogLevel.Debug, message, options);
        expect(debug).not.toHaveBeenCalled();
      });

      it("should default to Log level if none present", () => {
        logger.log(null, message, options);
        expect(log).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });
    });
  });

  describe("custom level (LogLevel.Error)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
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
        expect(log).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Error level", () => {
        logger.log(LogLevel.Error, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });

      it("should log Fatal level", () => {
        logger.log(LogLevel.Fatal, message, options);
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });
    });
  });

  describe("custom level (LogLevel.Fatal)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
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
        expect(error).toHaveBeenCalledWith(options.tag, message, options.data);
      });
    });
  });
});
