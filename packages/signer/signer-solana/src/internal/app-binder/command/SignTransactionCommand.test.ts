import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import {
  SignTransactionCommand,
  type SignTransactionCommandArgs,
} from "./SignTransactionCommand";

describe("SignTransactionCommand", () => {
  const defaultArgs: SignTransactionCommandArgs = {
    serializedTransaction: new Uint8Array(),
  };

  describe("getApdu", () => {
    it("should return the correct APDU when the data is empty", () => {
      // GIVEN
      const command = new SignTransactionCommand(defaultArgs);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array());
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x06);
      expect(apdu.p1).toBe(0x01);
      expect(apdu.p2).toBe(0x00);
    });

    it("should return the correct APDU when the data is not empty", () => {
      // GIVEN
      const command = new SignTransactionCommand({
        serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
      });

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x06);
      expect(apdu.p1).toBe(0x01);
      expect(apdu.p2).toBe(0x00);
    });
  });

  describe("parseResponse", () => {
    it("should return Noting when the response is empty", () => {
      // GIVEN
      const command = new SignTransactionCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array([]),
        }),
      );

      // THEN
      expect(result).toStrictEqual(CommandResultFactory({ data: Nothing }));
    });

    it("should return the signature when the response is not empty", () => {
      // GIVEN
      const command = new SignTransactionCommand(defaultArgs);
      // Uint8Array of 64 bytes
      const data = new Uint8Array(Array.from({ length: 64 }, (_, i) => i + 1));

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data,
        }),
      );

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Just(data),
        }),
      );
    });

    it("should return an error when the response is not successful", () => {
      // GIVEN
      const command = new SignTransactionCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x80]),
          data: new Uint8Array([]),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        fail("The result should be an error.");
      else {
        expect(result.error).toBeInstanceOf(UnknownDeviceExchangeError);
      }
    });

    it("should return an error when the response data is not valid", () => {
      // GIVEN
      const command = new SignTransactionCommand(defaultArgs);

      // WHEN
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array([0x01]),
        }),
      );

      // THEN
      if (isSuccessCommandResult(result))
        fail("The result should be an error.");
      else {
        expect(result.error).toEqual(
          new InvalidStatusWordError("Signature is missing"),
        );
      }
    });
  });
});
