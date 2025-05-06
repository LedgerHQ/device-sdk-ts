import {
  type ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import {
  SignEIP7702AuthorizationCommand,
  type SignEIP7702AuthorizationCommandArgs,
} from "./SignAuthorizationDelegationCommand";

const FIRST_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x34, 0x01, 0x00, 0x08, 0x00, 0x06, 0x4c, 0x65, 0x64, 0x67, 0x65, 0x72,
]);

const NEXT_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x34, 0x00, 0x00, 0x08, 0x00, 0x06, 0x4c, 0x65, 0x64, 0x67, 0x65, 0x72,
]);

const SUCCESS_RESPONSE = new Uint8Array([
  0x1b, 0x97, 0xa4, 0xca, 0x8f, 0x69, 0x46, 0x33, 0x59, 0x26, 0x01, 0xf5, 0xa2,
  0x3e, 0x0b, 0xcc, 0x55, 0x3c, 0x9d, 0x0a, 0x90, 0xd3, 0xa3, 0x42, 0x2d, 0x57,
  0x55, 0x08, 0xa9, 0x28, 0x98, 0xb9, 0x6e, 0x69, 0x50, 0xd0, 0x2e, 0x74, 0xe9,
  0xc1, 0x02, 0xc1, 0x64, 0xa2, 0x25, 0x53, 0x30, 0x82, 0xca, 0xbd, 0xd8, 0x90,
  0xef, 0xc4, 0x63, 0xf6, 0x7f, 0x60, 0xce, 0xfe, 0x8c, 0x3f, 0x87, 0xcf, 0xce,
]);

describe("SignEIP7702AuthorizationCommand", () => {
  describe("getApdu", () => {
    it("should return the first chunk raw APDU", () => {
      // GIVEN
      const args: SignEIP7702AuthorizationCommandArgs = {
        data: FIRST_CHUNK_APDU.slice(5),
        isFirstChunk: true,
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(FIRST_CHUNK_APDU);
    });

    it("should return the next chunk raw APDU", () => {
      // GIVEN
      const args: SignEIP7702AuthorizationCommandArgs = {
        data: FIRST_CHUNK_APDU.slice(5),
        isFirstChunk: false,
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(NEXT_CHUNK_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6a, 0x80]), // Invalid status code
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return success without result for first chunk", () => {
      // GIVEN
      const response: ApduResponse = {
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
        data: Buffer.from([]),
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Nothing,
        }),
      );
    });

    it("should return success if the response signature is valid", () => {
      // GIVEN
      const response: ApduResponse = {
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
        data: SUCCESS_RESPONSE,
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Just({
            r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
            s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
            v: 27,
          }),
        }),
      );
    });

    it("should return an error if r is missing", () => {
      // GIVEN
      const response: ApduResponse = {
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
        data: SUCCESS_RESPONSE.slice(0, 32),
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("R is missing"),
        }),
      );
    });

    it("should return an error if s is missing", () => {
      // GIVEN
      const response: ApduResponse = {
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
        data: SUCCESS_RESPONSE.slice(0, 64),
      };
      // WHEN
      const command = new SignEIP7702AuthorizationCommand({
        data: Uint8Array.from([]),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);
      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("S is missing"),
        }),
      );
    });
  });
});
