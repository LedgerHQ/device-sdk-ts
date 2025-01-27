import {
  type ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { EthAppCommandError } from "./utils/ethAppErrors";
import {
  StoreTransactionCommand,
  type StoreTransactionCommandArgs,
} from "./StoreTransactionCommand";

describe("StoreTransactionCommand", () => {
  describe("getApdu", () => {
    it("should return the raw APDU for the first chunk", () => {
      // GIVEN
      const args: StoreTransactionCommandArgs = {
        serializedTransaction: Uint8Array.from([0x01, 0x02, 0x03]),
        isFirstChunk: true,
      };

      // WHEN
      const command = new StoreTransactionCommand(args);
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x04, 0x00, 0x01, 0x03, 0x01, 0x02, 0x03]),
      );
    });

    it("should return the raw APDU for the subsequent chunk", () => {
      // GIVEN
      const args: StoreTransactionCommandArgs = {
        serializedTransaction: Uint8Array.from([0x04, 0x05, 0x06]),
        isFirstChunk: false,
      };

      // WHEN
      const command = new StoreTransactionCommand(args);
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x04, 0x80, 0x01, 0x03, 0x04, 0x05, 0x06]),
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
      const command = new StoreTransactionCommand({
        serializedTransaction: new Uint8Array(0),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        throw new Error("Expected error");
      } else {
        expect(result.error).toBeInstanceOf(EthAppCommandError);
      }
    });

    it("should return the correct response", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new StoreTransactionCommand({
        serializedTransaction: new Uint8Array(0),
        isFirstChunk: true,
      });
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBeUndefined();
      } else {
        throw new Error("Expected success");
      }
    });
  });
});
