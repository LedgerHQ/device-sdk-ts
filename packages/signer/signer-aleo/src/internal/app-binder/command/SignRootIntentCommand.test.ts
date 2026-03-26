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

import { SignRootIntentCommand } from "./SignRootIntentCommand";

describe("SignRootIntentCommand", () => {
  const mockDerivationPath = "44'/683'/0'";
  const mockChunkedData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

  describe("name", () => {
    it("should be 'signRootIntent'", () => {
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
        derivationPath: mockDerivationPath,
      });
      expect(command.name).toBe("signRootIntent");
    });
  });

  describe("getApdu", () => {
    it("should create correct APDU for the first chunk", () => {
      // Given
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
        derivationPath: mockDerivationPath,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.cla).toBe(ALEO_CLA);
      expect(apdu.ins).toBe(INS.SIGN_INTENT);
      expect(apdu.p1).toBe(P1.SIGN_MODE_ROOT);
      expect(apdu.p2).toBe(0x00);

      // Should ONLY contain chunked data
      expect(apdu.data.length).toBe(mockChunkedData.length);
      expect(apdu.data).toEqual(mockChunkedData);
    });

    it("should create correct APDU for subsequent chunks", () => {
      // Given
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: false,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.cla).toBe(ALEO_CLA);
      expect(apdu.ins).toBe(INS.SIGN_INTENT);
      expect(apdu.p1).toBe(P1.SIGN_MODE_ROOT);
      expect(apdu.p2).toBe(0x01);

      // Should ONLY contain chunked data
      expect(apdu.data.length).toBe(mockChunkedData.length);
      expect(apdu.data).toEqual(mockChunkedData);
    });

    it("should create correct APDU for any chunk", () => {
      // Given
      const customPath = "44'/683'/122'";
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
        derivationPath: customPath,
      });

      // When
      const apdu: Apdu = command.getApdu();

      // Then
      expect(apdu.data.length).toBe(mockChunkedData.length);
      expect(apdu.data).toEqual(mockChunkedData);
    });
  });

  describe("parseResponse", () => {
    it("should return hexadecimal string for successful response with data", () => {
      // Given
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: false,
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
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
        derivationPath: mockDerivationPath,
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

    it("should handle error response codes", () => {
      // Given
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
        derivationPath: mockDerivationPath,
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
      const command = new SignRootIntentCommand({
        dataLength: mockChunkedData.length,
        chunkedData: mockChunkedData,
        isFirst: true,
        derivationPath: mockDerivationPath,
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
