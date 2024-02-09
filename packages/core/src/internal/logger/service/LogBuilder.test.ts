import { Log } from "./Log";
import { LogBuilder } from "./LogBuilder";

class CustomError {
  _tag = "CustomError";
  originalError?: Error;

  constructor(originalError?: Error) {
    this.originalError = originalError;
  }
}

let log: Log;

describe("LogBuilder", () => {
  describe("build", () => {
    it("should create a Log instance with context and data", () => {
      log = LogBuilder.build(
        {
          type: "test",
        },
        {
          key: "value",
        },
        "test",
        "test2"
      );

      expect(log).toBeInstanceOf(Log);
      expect(log.context).toEqual({ type: "test" });
      expect(log.data).toEqual({ key: "value" });
      expect(log.messages).toEqual(["test", "test2"]);
    });

    it("should create a Log instance with an empty context and data", () => {
      log = LogBuilder.build(undefined, undefined, "test");
      expect(log.context).toEqual({});
      expect(log.data).toEqual({});
      expect(log.messages).toEqual(["test"]);
    });
  });

  describe("buildFromError", () => {
    it("should create a Log instance with a normal Error", () => {
      log = LogBuilder.buildFromError(new Error("test"), {}, { key: "value" });
      expect(log).toBeInstanceOf(Log);
      expect(log.context).toEqual({ type: "error" });
      expect(log.messages).toEqual(["test"]);
    });

    describe("custom Error", () => {
      it("with no originalError should create a Log", () => {
        log = LogBuilder.buildFromError(new CustomError(), { type: "error" });
        expect(log).toBeInstanceOf(Log);
        expect(log.context).toEqual({ type: "CustomError" });
        expect(log.messages).toEqual(["CustomError"]);
      });

      it("with originalError should create a Log", () => {
        const err = new CustomError(new Error("test"));
        log = LogBuilder.buildFromError(
          err,
          { type: "error" },
          { key: "value" }
        );
        expect(log).toBeInstanceOf(Log);
        expect(log.messages).toEqual(["test"]);
        expect(log.data).toEqual({ key: "value", error: err });
      });
    });
  });
});
