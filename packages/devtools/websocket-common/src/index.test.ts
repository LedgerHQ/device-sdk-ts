import { describe, expect, it } from "vitest";

import { formatSocketMessage, parseSocketMessage } from "./index";

describe("formatSocketMessage", () => {
  it("should format a message with type and payload", () => {
    const result = formatSocketMessage({
      type: "init",
      payload: "test-payload",
    });
    expect(result).toBe("init|test-payload");
  });

  it("should handle payload containing pipe characters", () => {
    const result = formatSocketMessage({
      type: "init",
      payload: "data|with|pipes",
    });
    expect(result).toBe("init|data|with|pipes");
  });
});

describe("parseSocketMessage", () => {
  it("should parse a valid message string", () => {
    const result = parseSocketMessage("init|test-payload");
    expect(result).toEqual({
      type: "init",
      payload: "test-payload",
    });
  });

  it("should handle payload containing pipe characters (potential edge case)", () => {
    const result = parseSocketMessage("init|data|with|pipes");
    expect(result).toEqual({
      type: "init",
      payload: "data|with|pipes",
    });
  });

  it("should throw an error for invalid message format", () => {
    expect(() => parseSocketMessage("invalid-message")).toThrow(
      "Invalid message format",
    );
  });
});
