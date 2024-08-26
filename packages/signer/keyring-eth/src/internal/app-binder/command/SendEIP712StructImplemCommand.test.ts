import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

import {
  SendEIP712StructImplemCommand,
  type SendEIP712StructImplemCommandArgs,
  StructImplemType,
} from "./SendEIP712StructImplemCommand";

const ROOT_APDU = Uint8Array.from([
  0xe0, 0x1c, 0x00, 0x00, 0x06, 0x6c, 0x65, 0x64, 0x67, 0x65, 0x72,
]);

const ARRAY_APDU = Uint8Array.from([0xe0, 0x1c, 0x00, 0x0f, 0x01, 0x13]);

const FIELD_LAST_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x1c, 0x00, 0xff, 0x06, 0x00, 0x04, 0x01, 0x02, 0x03, 0x04,
]);

const FIELD_OTHER_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x1c, 0x01, 0xff, 0x05, 0x05, 0x06, 0x07, 0x08, 0x09,
]);

describe("SendEIP712StructImplemCommand", () => {
  describe("getApdu", () => {
    it("should return the correct APDU for ROOT", () => {
      // GIVEN
      const args: SendEIP712StructImplemCommandArgs = {
        type: StructImplemType.ROOT,
        value: "ledger",
      };
      // WHEN
      const command = new SendEIP712StructImplemCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(ROOT_APDU);
    });
    it("should return the correct APDU for ARRAY", () => {
      // GIVEN
      const args: SendEIP712StructImplemCommandArgs = {
        type: StructImplemType.ARRAY,
        value: 19,
      };
      // WHEN
      const command = new SendEIP712StructImplemCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(ARRAY_APDU);
    });
    it("should return the correct APDU for FIELD when receiving last chunk", () => {
      // GIVEN
      const args: SendEIP712StructImplemCommandArgs = {
        type: StructImplemType.FIELD,
        value: {
          data: Uint8Array.from([0x00, 0x04, 0x01, 0x02, 0x03, 0x04]),
          isLastChunk: true,
        },
      };
      // WHEN
      const command = new SendEIP712StructImplemCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(FIELD_LAST_CHUNK_APDU);
    });
    it("should return the correct APDU for FIELD when receiving other chunk", () => {
      // GIVEN
      const args: SendEIP712StructImplemCommandArgs = {
        type: StructImplemType.FIELD,
        value: {
          data: Uint8Array.from([0x05, 0x06, 0x07, 0x08, 0x09]),
          isLastChunk: false,
        },
      };
      // WHEN
      const command = new SendEIP712StructImplemCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(FIELD_OTHER_CHUNK_APDU);
    });
  });
  describe("parseResponse", () => {
    it("should return an error if the response status code is not success", () => {
      // GIVEN
      const response = {
        data: new Uint8Array(),
        statusCode: new Uint8Array([0x6a, 0x80]),
      };
      // WHEN
      const command = new SendEIP712StructImplemCommand({
        type: StructImplemType.ROOT,
        value: "ledger",
      });
      // THEN
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
    });
    it("should not return an error if the response status code is success", () => {
      // GIVEN
      const response = {
        data: new Uint8Array(),
        statusCode: new Uint8Array([0x90, 0x00]),
      };
      // WHEN
      const command = new SendEIP712StructImplemCommand({
        type: StructImplemType.ROOT,
        value: "ledger",
      });
      // THEN
      expect(command.parseResponse(response)).toStrictEqual(
        CommandResultFactory({ data: undefined }),
      );
    });
  });
});
