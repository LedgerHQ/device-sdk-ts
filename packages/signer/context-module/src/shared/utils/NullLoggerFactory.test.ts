import type { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { NullLoggerFactory } from "./NullLoggerFactory";

describe("NullLoggerFactory", () => {
  it("returns a LoggerPublisherService-like obj", () => {
    const logger = NullLoggerFactory("any-tag") as LoggerPublisherService;

    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(Array.isArray(logger.subscribers)).toBe(true);
    expect(logger.subscribers).toHaveLength(0);
  });

  it("methods are no-ops (do not throw)", () => {
    const logger = NullLoggerFactory("test");

    expect(() => logger.debug("hello")).not.toThrow();
    expect(() => logger.info("hello")).not.toThrow();
    expect(() => logger.warn("hello")).not.toThrow();
    expect(() => logger.error("hello")).not.toThrow();

    expect(() => logger.debug("hello", { data: { a: 1 } })).not.toThrow();
  });

  it("returns a new object per call (current implementation)", () => {
    const logger1 = NullLoggerFactory("x");
    const logger2 = NullLoggerFactory("x");

    expect(logger1).not.toBe(logger2);
  });
});
