import { describe, expect, it } from "vitest";

import {
  formatApduReceivedLog,
  formatApduSendingLog,
  formatApduSentLog,
} from "./apduLogs";

describe("apduLogs", () => {
  describe("formatApduSendingLog", () => {
    it("should format APDU with correct format before sending", () => {
      const apdu = Uint8Array.from([0xe0, 0x01, 0x00, 0x00, 0x04]);
      expect(formatApduSendingLog(apdu)).toBe(
        "[will send APDU] ~...> e001000004",
      );
    });

    it("should handle empty APDU", () => {
      const apdu = Uint8Array.from([]);
      expect(formatApduSendingLog(apdu)).toBe("[will send APDU] ~...> ");
    });
  });

  describe("formatApduSentLog", () => {
    it("should format APDU with correct format after sending", () => {
      const apdu = Uint8Array.from([0xe0, 0x01, 0x00, 0x00, 0x04]);
      expect(formatApduSentLog(apdu)).toBe("[exchange] => e001000004");
    });

    it("should handle empty APDU", () => {
      const apdu = Uint8Array.from([]);
      expect(formatApduSentLog(apdu)).toBe("[exchange] => ");
    });
  });

  describe("formatApduReceivedLog", () => {
    it("should format APDU response with data and status code", () => {
      const apduResponse = {
        data: Uint8Array.from([0x01, 0x02, 0x03]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      };
      expect(formatApduReceivedLog(apduResponse)).toBe(
        "[exchange] <= 0102039000",
      );
    });

    it("should format APDU response with only status code when data is empty", () => {
      const apduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      };
      expect(formatApduReceivedLog(apduResponse)).toBe("[exchange] <= 9000");
    });

    it("should format error status code correctly", () => {
      const apduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x69, 0x85]),
      };
      expect(formatApduReceivedLog(apduResponse)).toBe("[exchange] <= 6985");
    });
  });
});
