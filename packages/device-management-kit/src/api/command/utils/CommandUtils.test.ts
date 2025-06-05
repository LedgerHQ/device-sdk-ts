import { CloseAppCommand } from "@api/command/os/CloseAppCommand";
import { GetAppAndVersionCommand } from "@api/command/os/GetAppAndVersionCommand";
import { OpenAppCommand } from "@api/command/os/OpenAppCommand";
import { ApduResponse } from "@api/device-session/ApduResponse";

import { CommandUtils } from "./CommandUtils";

describe("CommandUtils", () => {
  describe("static isSuccessResponse", () => {
    it("should return true if the status code is 0x9000", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isSuccessResponse(response)).toBe(true);
    });

    it("should return false if the status code is not 0x9000", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6e, 0x80]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isSuccessResponse(response)).toBe(false);
    });

    it("should return false if the status code is not 2 bytes long", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x55]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isSuccessResponse(response)).toBe(false);
    });
  });

  describe("static isValidStatusCode", () => {
    it("should return true if the status code is 2 bytes long", () => {
      const statusCode = Uint8Array.from([0x90, 0x00]);

      expect(CommandUtils.isValidStatusCode(statusCode)).toBe(true);
    });

    it("should return false if the status code is not 2 bytes long", () => {
      const statusCode = Uint8Array.from([0x90]);

      expect(CommandUtils.isValidStatusCode(statusCode)).toBe(false);
    });
  });

  describe("static isLockedDeviceResponse", () => {
    it("should return true if the status code is 0x5515", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x55, 0x15]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isLockedDeviceResponse(response)).toBe(true);
    });

    it("should return true if the status code is 0x6982", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x69, 0x82]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isLockedDeviceResponse(response)).toBe(true);
    });

    it("should return true if the status code is 0x5303", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x53, 0x03]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isLockedDeviceResponse(response)).toBe(true);
    });

    it("should return false if the status code is not 0x5515", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isLockedDeviceResponse(response)).toBe(false);
    });

    it("should return false if the status code is not 2 bytes long", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isLockedDeviceResponse(response)).toBe(false);
    });
  });

  describe("static isRefusedByUser", () => {
    it("should return true if the status code is 0x5501", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x55, 0x01]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isRefusedByUser(response)).toBe(true);
    });

    it("should return true if the status code is 0x6985", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x69, 0x85]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isRefusedByUser(response)).toBe(true);
    });

    it("should return false if the status code is not 0x5501", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isRefusedByUser(response)).toBe(false);
    });
  });

  describe("static isAppAlreadyInstalled", () => {
    it("should return true if the status code is 0x6a80", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isAppAlreadyInstalled(response)).toBe(true);
    });

    it("should return true if the status code is 0x6a81", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x81]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isAppAlreadyInstalled(response)).toBe(true);
    });

    it("should return true if the status code is 0x6a8e", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x8e]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isAppAlreadyInstalled(response)).toBe(true);
    });

    it("should return true if the status code is 0x6a8f", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x8f]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isAppAlreadyInstalled(response)).toBe(true);
    });

    it("should return false if the status code is not 0x6a80", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isAppAlreadyInstalled(response)).toBe(false);
    });
  });

  describe("static isOutOfMemory", () => {
    it("should return true if the status code is 0x6a84", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x84]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isOutOfMemory(response)).toBe(true);
    });

    it("should return true if the status code is 0x6a85", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x85]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isOutOfMemory(response)).toBe(true);
    });

    it("should return true if the status code is 0x5102", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x51, 0x02]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isOutOfMemory(response)).toBe(true);
    });

    it("should return true if the status code is 0x5103", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x51, 0x03]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isOutOfMemory(response)).toBe(true);
    });

    it("should return false if the status code is not 0x6a84", () => {
      const response = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([]),
      });

      expect(CommandUtils.isOutOfMemory(response)).toBe(false);
    });
  });

  describe("static isApduThatTriggersDisconnection", () => {
    it("should return true if the APDU is openApp", () => {
      const apdu = new OpenAppCommand({ appName: "test" })
        .getApdu()
        .getRawApdu();

      expect(CommandUtils.isApduThatTriggersDisconnection(apdu)).toBe(true);
    });

    it("should return true if the APDU is closeApp", () => {
      const apdu = new CloseAppCommand().getApdu().getRawApdu();

      expect(CommandUtils.isApduThatTriggersDisconnection(apdu)).toBe(true);
    });

    it("should return false if the APDU is not a known one", () => {
      const apdu = new GetAppAndVersionCommand().getApdu().getRawApdu();

      expect(CommandUtils.isApduThatTriggersDisconnection(apdu)).toBe(false);
    });
  });
});
