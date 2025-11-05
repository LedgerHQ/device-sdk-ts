import {
  type ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { EthAppCommandError } from "./utils/ethAppErrors";
import {
  ProvideEnumCommand,
  type ProvideEnumCommandArgs,
} from "./ProvideEnumCommand";

describe("ProvideEnumCommand", () => {
  describe("name", () => {
    it("should be 'provideEnum'", () => {
      const command = new ProvideEnumCommand({
        data: new Uint8Array(),
        isFirstChunk: true,
      });
      expect(command.name).toBe("provideEnum");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU for the first chunk", () => {
      // GIVEN
      const args: ProvideEnumCommandArgs = {
        data: Uint8Array.from([0x01, 0x02, 0x03]),
        isFirstChunk: true,
      };

      // WHEN
      const command = new ProvideEnumCommand(args);
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x24, 0x01, 0x00, 0x03, 0x01, 0x02, 0x03]),
      );
    });

    it("should return the raw APDU for the subsequent chunk", () => {
      // GIVEN
      const args: ProvideEnumCommandArgs = {
        data: Uint8Array.from([0x04, 0x05, 0x06]),
        isFirstChunk: false,
      };

      // WHEN
      const command = new ProvideEnumCommand(args);
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x24, 0x00, 0x00, 0x03, 0x04, 0x05, 0x06]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x6d, 0x00]), // Invalid status code
      };

      // WHEN
      const command = new ProvideEnumCommand({
        data: new Uint8Array(0),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        throw new Error("Expected an error");
      } else {
        expect(result.error).toBeDefined();
        expect(result.error).toBeInstanceOf(EthAppCommandError);
      }
    });

    it("should return a success result if the response status code is valid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new ProvideEnumCommand({
        data: new Uint8Array(0),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);

      // THEN
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
