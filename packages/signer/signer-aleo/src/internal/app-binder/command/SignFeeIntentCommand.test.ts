import {
  type Apdu,
  type ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  ALEO_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import { SignFeeIntentCommand } from "./SignFeeIntentCommand";

describe("SignFeeIntentCommand", () => {
  const mockFeeIntent = new Uint8Array([0x05, 0x06, 0x07, 0x08]);

  describe("name", () => {
    it("should be 'signFeeIntent'", () => {
      const command = new SignFeeIntentCommand({
        feeIntent: mockFeeIntent,
      });
      expect(command.name).toBe("signFeeIntent");
    });
  });

  describe("getApdu", () => {
    it("should create correct APDU with P1=0x02", () => {
      // Given
      const command = new SignFeeIntentCommand({
        feeIntent: mockFeeIntent,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.cla).toBe(ALEO_CLA);
      expect(apdu.ins).toBe(INS.SIGN_INTENT);
      expect(apdu.p1).toBe(P1.SIGN_MODE_FEE);
      expect(apdu.p2).toBe(P2_DEFAULT);

      // Should only contain length (2 bytes) + fee intent data (no derivation path)
      expect(apdu.data.length).toBe(2 + mockFeeIntent.length);
      const expectedData = new Uint8Array(2 + mockFeeIntent.length);
      expectedData[0] = 0x00;
      expectedData[1] = mockFeeIntent.length;
      expectedData.set(mockFeeIntent, 2);
      expect(apdu.data).toEqual(expectedData);
    });
  });

  describe("parseResponse", () => {
    it("should return hexadecimal string for successful response", () => {
      // Given
      const command = new SignFeeIntentCommand({
        feeIntent: mockFeeIntent,
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

    it("should return error if extraction fails", () => {
      // Given
      const command = new SignFeeIntentCommand({
        feeIntent: mockFeeIntent,
      });

      const response: ApduResponse = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([]), // Empty data when extraction is expected
      };

      // When
      const result = command.parseResponse(response);

      // Then
      expect(result).toEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError(
            "Failed to extract data from response",
          ),
        }),
      );
    });

    it("should handle user rejection", () => {
      // Given
      const command = new SignFeeIntentCommand({
        feeIntent: mockFeeIntent,
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
        feeIntent: mockFeeIntent,
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
