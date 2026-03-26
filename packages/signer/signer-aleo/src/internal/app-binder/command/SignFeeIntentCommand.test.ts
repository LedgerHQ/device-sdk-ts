import {
  type Apdu,
  type ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  ALEO_CLA,
  INS,
  P1,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import { SignFeeIntentCommand } from "./SignFeeIntentCommand";

describe("SignFeeIntentCommand", () => {
  const mockChunkedData = new Uint8Array([0x05, 0x06, 0x07, 0x08]);

  describe("name", () => {
    it("should be 'signFeeIntent'", () => {
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
      });
      expect(command.name).toBe("signFeeIntent");
    });
  });

  describe("getApdu", () => {
    it("should create correct APDU for the first chunk", () => {
      // Given
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.cla).toBe(ALEO_CLA);
      expect(apdu.ins).toBe(INS.SIGN_INTENT);
      expect(apdu.p1).toBe(P1.SIGN_MODE_FEE);
      expect(apdu.p2).toBe(0x00);

      // Should ONLY contain chunked data
      expect(apdu.data.length).toBe(mockChunkedData.length);
      expect(apdu.data).toEqual(mockChunkedData);
    });

    it("should create correct APDU for subsequent chunks", () => {
      // Given
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: false,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.cla).toBe(ALEO_CLA);
      expect(apdu.ins).toBe(INS.SIGN_INTENT);
      expect(apdu.p1).toBe(P1.SIGN_MODE_FEE);
      expect(apdu.p2).toBe(0x01);

      // Should ONLY contain chunked data
      expect(apdu.data.length).toBe(mockChunkedData.length);
      expect(apdu.data).toEqual(mockChunkedData);
    });
  });

  describe("parseResponse", () => {
    it("should return hexadecimal string for successful response", () => {
      // Given
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
      });

      const response: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x02, 0x03]),
      };

      // When
      const result = command.parseResponse(response);

      // Then
      expect(result).toEqual(
        CommandResultFactory({
          data: {
            tlvSignature: "010203",
          },
        }),
      );
    });

    it("should return empty signature for successful response without data (intermediate chunks)", () => {
      // Given
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
      });

      const response: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]),
      };

      // When
      const result = command.parseResponse(response);

      // Then
      expect(result).toEqual(
        CommandResultFactory({
          data: {
            tlvSignature: "",
          },
        }),
      );
    });

    it("should handle user rejection", () => {
      // Given
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
      });

      // User denied
      const response: ApduResponse = {
        statusCode: new Uint8Array([0x69, 0xf0]),
        data: new Uint8Array([]),
      };

      // When
      const result = command.parseResponse(response);

      // Then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toEqual(
          expect.objectContaining({
            _tag: "AleoAppCommandError",
            errorCode: "69f0",
            message: "Denied by user",
          }),
        );
      }
    });

    it("should handle device error codes", () => {
      // Given
      const command = new SignFeeIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
      });

      // Signature fail (0xb008)
      const response: ApduResponse = {
        statusCode: new Uint8Array([0xb0, 0x08]),
        data: new Uint8Array([]),
      };

      // When
      const result = command.parseResponse(response);

      // Then
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toEqual(
          expect.objectContaining({
            _tag: "AleoAppCommandError",
            errorCode: "b008",
            message: "Signature fail",
          }),
        );
      }
    });
  });
});
