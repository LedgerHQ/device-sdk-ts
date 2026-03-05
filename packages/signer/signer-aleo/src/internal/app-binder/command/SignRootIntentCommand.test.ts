import {
  type Apdu,
  type ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignRootIntentCommand } from "./SignRootIntentCommand";

describe("SignRootIntentCommand", () => {
  const mockDerivationPath = "m/44'/1'/0'/0/0";
  const mockRootIntent = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

  describe("name", () => {
    it("should be 'signRootIntent'", () => {
      const command = new SignRootIntentCommand({
        derivationPath: "44'/683'/0'",
        rootIntent: mockRootIntent,
      });
      expect(command.name).toBe("signRootIntent");
    });
  });

  describe("getApdu", () => {
    it("should create correct APDU", () => {
      // Given
      const command = new SignRootIntentCommand({
        derivationPath: "44'/683'/0'",
        rootIntent: mockRootIntent,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.cla).toBe(0xe0);
      expect(apdu.ins).toBe(0x06);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);

      // Should contain derivation path (3 path elements) + root intent length (2 bytes) + root intent data
      const expectedPathLength = 1 + 3 * 4; // 1 byte for count + 3 elements * 4 bytes each
      expect(apdu.data.length).toBe(
        expectedPathLength + 2 + mockRootIntent.length,
      );

      // Verify path count is 3
      expect(apdu.data[0]).toBe(3);
    });

    it("should handle custom derivation path", () => {
      // Given
      const customPath = "44'/683'/122'";
      const command = new SignRootIntentCommand({
        derivationPath: customPath,
        rootIntent: mockRootIntent,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.data[0]).toBe(3); // 3 elements
      const expectedPathLength = 1 + 3 * 4;
      expect(apdu.data.length).toBe(
        expectedPathLength + 2 + mockRootIntent.length,
      );
    });
  });

  describe("parseResponse", () => {
    it("should return hexadecimal string for successful response", () => {
      // Given
      const command = new SignRootIntentCommand({
        derivationPath: mockDerivationPath,
        rootIntent: mockRootIntent,
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
      const command = new SignRootIntentCommand({
        derivationPath: mockDerivationPath,
        rootIntent: mockRootIntent,
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

    it("should handle error response codes", () => {
      // Given
      const command = new SignRootIntentCommand({
        derivationPath: mockDerivationPath,
        rootIntent: mockRootIntent,
      });

      // User denied
      const response: ApduResponse = {
        statusCode: new Uint8Array([0x69, 0x85]),
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
            errorCode: "6985",
            message: "Denied by user",
          }),
        );
      }
    });

    it("should handle device error codes", () => {
      // Given
      const command = new SignRootIntentCommand({
        derivationPath: mockDerivationPath,
        rootIntent: mockRootIntent,
      });

      // Wrong transaction length
      const response: ApduResponse = {
        statusCode: new Uint8Array([0xb0, 0x04]),
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
            errorCode: "b004",
            message: "Wrong transaction length",
          }),
        );
      }
    });
  });
});
