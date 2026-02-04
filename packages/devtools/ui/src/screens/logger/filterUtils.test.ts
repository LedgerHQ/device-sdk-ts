import {
  type FilterToken,
  matchesFilter,
  parseFilterQuery,
} from "./filterUtils";
import { type LogData } from "./types";

const createLog = (overrides: Partial<LogData> = {}): LogData => ({
  timestamp: "2024-01-01T00:00:00.000Z",
  tag: "TestTag",
  verbosity: "info",
  message: "Test message",
  payload: {},
  payloadJSON: "{}",
  ...overrides,
});

describe("filterUtils", () => {
  describe("parseFilterQuery", () => {
    it("should return empty array for empty string", () => {
      // GIVEN
      const query = "";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return empty array for whitespace-only string", () => {
      // GIVEN
      const query = "   ";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toEqual([]);
    });

    it("should parse single keyword", () => {
      // GIVEN
      const query = "error";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toEqual([
        { type: "keyword", value: "error", exclude: false },
      ]);
    });

    it("should parse multiple keywords", () => {
      // GIVEN
      const query = "error warning";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toEqual([
        { type: "keyword", value: "error", exclude: false },
        { type: "keyword", value: "warning", exclude: false },
      ]);
    });

    it("should parse negative keyword", () => {
      // GIVEN
      const query = "-debug";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toEqual([
        { type: "keyword", value: "debug", exclude: true },
      ]);
    });

    it("should parse regex pattern", () => {
      // GIVEN
      const query = "/error\\d+/";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("regex");
      expect(result[0]!.exclude).toBe(false);
      expect((result[0] as { pattern: RegExp }).pattern.source).toBe(
        "error\\d+",
      );
    });

    it("should parse negative regex pattern", () => {
      // GIVEN
      const query = "-/test/";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("regex");
      expect(result[0]!.exclude).toBe(true);
      expect((result[0] as { pattern: RegExp }).pattern.source).toBe("test");
    });

    it("should parse mixed tokens", () => {
      // GIVEN
      const query = "error -debug /\\d+/";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        type: "keyword",
        value: "error",
        exclude: false,
      });
      expect(result[1]).toEqual({
        type: "keyword",
        value: "debug",
        exclude: true,
      });
      expect(result[2]!.type).toBe("regex");
      expect(result[2]!.exclude).toBe(false);
    });

    it("should handle invalid regex gracefully by treating as keyword", () => {
      // GIVEN
      const query = "/[invalid/";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("keyword");
    });

    it("should ignore standalone dash", () => {
      // GIVEN
      const query = "error - warning";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      // The "-" alone should be ignored (empty value after removing -)
      expect(result).toEqual([
        { type: "keyword", value: "error", exclude: false },
        { type: "keyword", value: "warning", exclude: false },
      ]);
    });

    it("should convert keywords to lowercase", () => {
      // GIVEN
      const query = "ERROR Warning";

      // WHEN
      const result = parseFilterQuery(query);

      // THEN
      expect(result).toEqual([
        { type: "keyword", value: "error", exclude: false },
        { type: "keyword", value: "warning", exclude: false },
      ]);
    });
  });

  describe("matchesFilter", () => {
    it("should match all logs when no tokens", () => {
      // GIVEN
      const log = createLog({ message: "any message" });
      const tokens: FilterToken[] = [];

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should match log with keyword in message", () => {
      // GIVEN
      const log = createLog({ message: "An error occurred" });
      const tokens = parseFilterQuery("error");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should match log with keyword in tag", () => {
      // GIVEN
      const log = createLog({
        tag: "ErrorHandler",
        message: "Something happened",
      });
      const tokens = parseFilterQuery("error");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should match log with keyword in payload (object)", () => {
      // GIVEN
      const log = createLog({
        message: "Request completed",
        payload: { status: "error", code: 500 },
      });
      const tokens = parseFilterQuery("error");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should match log with keyword in payload (string)", () => {
      // GIVEN
      const log = createLog({
        message: "Request completed",
        payload: "error details here",
      });
      const tokens = parseFilterQuery("error");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should not match log without keyword", () => {
      // GIVEN
      const log = createLog({ message: "Everything is fine" });
      const tokens = parseFilterQuery("error");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(false);
    });

    it("should exclude log with negative keyword", () => {
      // GIVEN
      const log = createLog({ message: "Debug info" });
      const tokens = parseFilterQuery("-debug");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(false);
    });

    it("should match log that doesn't contain excluded keyword", () => {
      // GIVEN
      const log = createLog({ message: "Error occurred" });
      const tokens = parseFilterQuery("-debug");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should match log with regex pattern", () => {
      // GIVEN
      const log = createLog({ message: "Error code: 404" });
      const tokens = parseFilterQuery("/\\d{3}/");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should not match log that doesn't match regex", () => {
      // GIVEN
      const log = createLog({ message: "Error occurred" });
      const tokens = parseFilterQuery("/\\d{3}/");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(false);
    });

    it("should exclude log with negative regex", () => {
      // GIVEN
      const log = createLog({ message: "Debug: test123" });
      const tokens = parseFilterQuery("-/test\\d+/");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(false);
    });

    it("should require ALL include keywords to match (AND logic)", () => {
      // GIVEN
      const log = createLog({ message: "Error in connection" });
      const tokens = parseFilterQuery("error connection");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should not match if one include keyword is missing", () => {
      // GIVEN
      const log = createLog({ message: "Error occurred" });
      const tokens = parseFilterQuery("error connection");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(false);
    });

    it("should handle mixed include and exclude filters", () => {
      // GIVEN
      const log = createLog({ message: "Error in production" });
      const tokens = parseFilterQuery("error -debug");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should exclude when include matches but exclude also matches", () => {
      // GIVEN
      const log = createLog({ message: "Error debug info" });
      const tokens = parseFilterQuery("error -debug");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(false);
    });

    it("should be case insensitive for keywords", () => {
      // GIVEN
      const log = createLog({ message: "ERROR occurred" });
      const tokens = parseFilterQuery("error");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });

    it("should be case insensitive for regex (i flag)", () => {
      // GIVEN
      const log = createLog({ message: "ERROR occurred" });
      const tokens = parseFilterQuery("/error/");

      // WHEN
      const result = matchesFilter(log, tokens);

      // THEN
      expect(result).toBe(true);
    });
  });
});
