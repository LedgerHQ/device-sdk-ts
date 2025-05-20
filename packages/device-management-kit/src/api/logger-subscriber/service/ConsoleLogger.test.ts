import { LogLevel } from "@api/logger-subscriber/model/LogLevel";
import { type LogSubscriberOptions } from "@api/logger-subscriber/model/LogSubscriberOptions";

import { ConsoleLogger } from "./ConsoleLogger";

const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
const info = vi.spyOn(console, "info").mockImplementation(vi.fn());
const debug = vi.spyOn(console, "debug").mockImplementation(vi.fn());
const error = vi.spyOn(console, "error").mockImplementation(vi.fn());
const log = vi.spyOn(console, "log").mockImplementation(vi.fn());

let logger: ConsoleLogger;
const options: LogSubscriberOptions = {
  data: { key: "value" },
  timestamp: 1,
  tag: "tag",
};
const message = "message";

describe("ConsoleLogger", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("default level (LogLevel.Debug)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
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

      it("should not log Verbose level", () => {
        logger.log(LogLevel.Verbose, message, options);
        expect(debug).not.toHaveBeenCalled();
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

  describe("custom level (LogLevel.Verbose)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Verbose);
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

      it("should log Verbose level", () => {
        logger.log(LogLevel.Verbose, message, options);
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
      vi.clearAllMocks();
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

      it("should not log Verbose level", () => {
        logger.log(LogLevel.Verbose, message, options);
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
      vi.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Warning);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should not log Verbose level", () => {
        logger.log(LogLevel.Verbose, message, options);
        expect(debug).not.toHaveBeenCalled();
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
      vi.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Error);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should not log Verbose level", () => {
        logger.log(LogLevel.Verbose, message, options);
        expect(debug).not.toHaveBeenCalled();
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
      vi.clearAllMocks();
      logger = new ConsoleLogger(LogLevel.Fatal);
    });

    describe("log", () => {
      it("should not log Info level", () => {
        logger.log(LogLevel.Info, message, options);
        expect(info).not.toHaveBeenCalled();
      });

      it("should not log Verbose level", () => {
        logger.log(LogLevel.Verbose, message, options);
        expect(debug).not.toHaveBeenCalled();
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

  describe("Uint8Array", () => {
    it("should log as an hexastring", () => {
      // given
      logger = new ConsoleLogger(LogLevel.Info);
      const apdu = Uint8Array.from([0xb0, 0x43, 0x44, 0x66]);
      const response = {
        data: Uint8Array.from([0x83, 0x89, 0x99]),
        statusCode: Uint8Array.from([0x90, 0x00]),
        log: "log",
      };
      const other = "other";
      const message = "message";
      const options: LogSubscriberOptions = {
        data: { apdu, response, other },
        timestamp: 1,
        tag: "tag",
      };

      // when
      logger.log(LogLevel.Info, message, options);

      // then
      expect(info).toHaveBeenCalledWith("[tag]", "message", {
        apdu: "0xb0434466",
        response: {
          data: "0x838999",
          statusCode: "0x9000",
          log: "log",
        },
        other: "other",
      });
    });
  });
});
