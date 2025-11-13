import {
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { EthAppCommandError } from "./utils/ethAppErrors";
import { StartTransactionCommand } from "./StartTransactionCommand";

describe("StartTransactionCommand", () => {
  describe("name", () => {
    it("should be 'startTransaction'", () => {
      const command = new StartTransactionCommand();
      expect(command.name).toBe("startTransaction");
    });
  });

  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // WHEN
      const command = new StartTransactionCommand();
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x04, 0x00, 0x02, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response = {
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x6d, 0x00]), // Invalid status code
      };

      // WHEN
      const command = new StartTransactionCommand();
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(EthAppCommandError);
      }
    });

    it("should return the correct response", () => {
      // GIVEN
      const response = {
        data: Uint8Array.from([
          0x01,
          ...Array<number>(32).fill(0x02),
          ...Array<number>(32).fill(0x03),
        ]), // Some data
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new StartTransactionCommand();
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data.extract()).toEqual({
          r: "0x0202020202020202020202020202020202020202020202020202020202020202",
          s: "0x0303030303030303030303030303030303030303030303030303030303030303",
          v: 1,
        });
      } else {
        assert.fail("Expected a success");
      }
    });

    it("should return an error if v is not valid", () => {
      // GIVEN
      const response = {
        data: Uint8Array.from([]), // No data
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new StartTransactionCommand();
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result.error.originalError).toEqual(new Error("V is missing"));
      }
    });

    it("should return an error if r is not valid", () => {
      // GIVEN
      const response = {
        data: Uint8Array.from([0x01, ...Array<number>(20).fill(0x02)]), // Invalid r
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new StartTransactionCommand();
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result.error.originalError).toEqual(new Error("R is missing"));
      }
    });

    it("should return an error if s is not valid", () => {
      // GIVEN
      const response = {
        data: Uint8Array.from([
          0x01,
          ...Array<number>(32).fill(0x02),
          ...Array<number>(20).fill(0x02),
        ]), // Invalid s
        statusCode: Uint8Array.from([0x90, 0x00]), // Success status code
      };

      // WHEN
      const command = new StartTransactionCommand();
      const result = command.parseResponse(response);

      // THEN
      if (isSuccessCommandResult(result)) {
        assert.fail("Expected an error");
      } else {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(result.error.originalError).toEqual(new Error("S is missing"));
      }
    });
  });
});
