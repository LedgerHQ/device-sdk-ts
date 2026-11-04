import {
  type ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { EthAppCommandError } from "./utils/ethAppErrors";
import {
  SendEIP712ValuesCommand,
  type SendEIP712ValuesCommandArgs,
} from "./SendEIP712ValuesCommand";

describe("SendEIP712ValuesCommand", () => {
  describe("name", () => {
    it("should be 'sendEIP712Values'", () => {
      const command = new SendEIP712ValuesCommand({
        data: new Uint8Array(),
        isFirstChunk: true,
      });
      expect(command.name).toBe("sendEIP712Values");
    });
  });

  describe("getApdu", () => {
    it("should flag the first chunk on P1 and select V2 on P2", () => {
      // GIVEN
      const args: SendEIP712ValuesCommandArgs = {
        data: Uint8Array.from([0x01, 0x02, 0x03]),
        isFirstChunk: true,
      };

      // WHEN
      const apdu = new SendEIP712ValuesCommand(args).getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x1c, 0x01, 0x02, 0x03, 0x01, 0x02, 0x03]),
      );
    });

    it("should clear the chunk flag on a following chunk", () => {
      // GIVEN
      const args: SendEIP712ValuesCommandArgs = {
        data: Uint8Array.from([0x04, 0x05, 0x06]),
        isFirstChunk: false,
      };

      // WHEN
      const apdu = new SendEIP712ValuesCommand(args).getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x1c, 0x00, 0x02, 0x03, 0x04, 0x05, 0x06]),
      );
    });

    it("should carry an empty payload without data", () => {
      // GIVEN
      const args: SendEIP712ValuesCommandArgs = {
        data: new Uint8Array(),
        isFirstChunk: true,
      };

      // WHEN
      const apdu = new SendEIP712ValuesCommand(args).getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x1c, 0x01, 0x02, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return an error when the app refuses the chunk", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x69, 0x86]), // command not allowed
      };

      // WHEN
      const result = new SendEIP712ValuesCommand({
        data: new Uint8Array(),
        isFirstChunk: true,
      }).parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        throw new Error("Expected an error");
      }
      expect(result.error).toBeInstanceOf(EthAppCommandError);
    });

    it("should return a void success when the app accepts the chunk", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      };

      // WHEN
      const result = new SendEIP712ValuesCommand({
        data: new Uint8Array(),
        isFirstChunk: false,
      }).parseResponse(response);

      // THEN
      if (!isSuccessCommandResult(result)) {
        throw new Error("Expected a success");
      }
      expect(result.data).toBeUndefined();
    });
  });
});
