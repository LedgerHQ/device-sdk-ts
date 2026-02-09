import { describe, expect, it } from "vitest";

import { noopLogger, noopLoggerFactory } from "./noopLoggerFactory";

describe("noopLogger", () => {
  it("should have an empty subscribers array", () => {
    expect(noopLogger.subscribers).toEqual([]);
  });

  it("should not throw when calling error", () => {
    expect(() => noopLogger.error("test")).not.toThrow();
  });

  it("should not throw when calling warn", () => {
    expect(() => noopLogger.warn("test")).not.toThrow();
  });

  it("should not throw when calling info", () => {
    expect(() => noopLogger.info("test")).not.toThrow();
  });

  it("should not throw when calling debug", () => {
    expect(() => noopLogger.debug("test")).not.toThrow();
  });

  it("should not throw when calling methods with options", () => {
    const options = { data: { key: "value" } };
    expect(() => noopLogger.error("test", options)).not.toThrow();
    expect(() => noopLogger.warn("test", options)).not.toThrow();
    expect(() => noopLogger.info("test", options)).not.toThrow();
    expect(() => noopLogger.debug("test", options)).not.toThrow();
  });
});

describe("noopLoggerFactory", () => {
  it("should return a LoggerPublisherService regardless of tag", () => {
    const logger = noopLoggerFactory("any-tag");
    expect(logger).toBeDefined();
    expect(logger.subscribers).toEqual([]);
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should always return the same noopLogger instance", () => {
    const logger1 = noopLoggerFactory("tag-a");
    const logger2 = noopLoggerFactory("tag-b");
    expect(logger1).toBe(logger2);
    expect(logger1).toBe(noopLogger);
  });
});
