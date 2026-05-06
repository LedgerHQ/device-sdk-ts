import {
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { ZCASH_CLA } from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";

const GET_ADDRESS_INS = 0x40;

// Standard Zcash BIP44 path: m/44'/133'/0'/0/0
// Path elements (BE u32): 0x8000002C, 0x80000085, 0x80000000, 0x00000000, 0x00000000
const GET_ADDRESS_APDU_NO_DISPLAY = Uint8Array.from([
  ZCASH_CLA,
  GET_ADDRESS_INS,
  0x00, // P1 (no display)
  0x00, // P2
  0x15, // Data length: 1 (path len) + 5*4 (path elements) = 21
  0x05, // Number of path elements
  0x80,
  0x00,
  0x00,
  0x2c, // 44'
  0x80,
  0x00,
  0x00,
  0x85, // 133'
  0x80,
  0x00,
  0x00,
  0x00, // 0'
  0x00,
  0x00,
  0x00,
  0x00, // 0
  0x00,
  0x00,
  0x00,
  0x00, // 0
]);

const GET_ADDRESS_APDU_WITH_DISPLAY = Uint8Array.from([
  ZCASH_CLA,
  GET_ADDRESS_INS,
  0x01, // P1 (display on device)
  0x00, // P2
  0x15, // Data length: 21
  0x05,
  0x80,
  0x00,
  0x00,
  0x2c,
  0x80,
  0x00,
  0x00,
  0x85,
  0x80,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
]);

// m/44'/133'/1'/0/5
const GET_ADDRESS_APDU_CUSTOM_PATH = Uint8Array.from([
  ZCASH_CLA,
  GET_ADDRESS_INS,
  0x00, // P1 (no display)
  0x00, // P2
  0x15, // Data length: 21
  0x05,
  0x80,
  0x00,
  0x00,
  0x2c, // 44'
  0x80,
  0x00,
  0x00,
  0x85, // 133'
  0x80,
  0x00,
  0x00,
  0x01, // 1'
  0x00,
  0x00,
  0x00,
  0x00, // 0
  0x00,
  0x00,
  0x00,
  0x05, // 5
]);

function buildSuccessResponse(
  publicKey: Uint8Array,
  address: string,
  chainCode: Uint8Array,
): ApduResponse {
  const addressBytes = new TextEncoder().encode(address);
  const data = new Uint8Array(
    1 + publicKey.length + 1 + addressBytes.length + chainCode.length,
  );
  let offset = 0;

  data[offset++] = publicKey.length;
  data.set(publicKey, offset);
  offset += publicKey.length;

  data[offset++] = addressBytes.length;
  data.set(addressBytes, offset);
  offset += addressBytes.length;

  data.set(chainCode, offset);

  return new ApduResponse({
    statusCode: new Uint8Array([0x90, 0x00]),
    data,
  });
}

describe("GetAddressCommand", () => {
  const defaultArgs = {
    derivationPath: "44'/133'/0'/0/0",
    checkOnDevice: false,
  };

  describe("name", () => {
    it("should be 'GetAddress'", () => {
      const command = new GetAddressCommand(defaultArgs);
      expect(command.name).toBe("GetAddress");
    });
  });

  describe("getApdu", () => {
    it("should return correct APDU with checkOnDevice false", () => {
      const command = new GetAddressCommand(defaultArgs);
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_ADDRESS_APDU_NO_DISPLAY);
    });

    it("should return correct APDU with checkOnDevice true", () => {
      const command = new GetAddressCommand({
        ...defaultArgs,
        checkOnDevice: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_ADDRESS_APDU_WITH_DISPLAY);
    });

    it("should return correct APDU with a custom derivation path", () => {
      const command = new GetAddressCommand({
        derivationPath: "44'/133'/1'/0/5",
        checkOnDevice: false,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_ADDRESS_APDU_CUSTOM_PATH);
    });
  });

  describe("parseResponse", () => {
    const publicKey = new Uint8Array(65).fill(0xab);
    const address = "t1KstBMLLaGcEBGKFxeGqTGmtCNsDE79Ljd";
    const chainCode = new Uint8Array(32).fill(0xcd);

    it("should return publicKey, address, and chainCode on success", () => {
      const command = new GetAddressCommand(defaultArgs);
      const response = buildSuccessResponse(publicKey, address, chainCode);

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toStrictEqual(publicKey);
        expect(result.data.address).toBe(address);
        expect(result.data.chainCode).toStrictEqual(chainCode);
      }
    });

    it("should return ZcashAppCommandError when user denies", () => {
      const command = new GetAddressCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ZcashAppCommandError;
        expect(err.errorCode).toBe("6985");
      }
    });

    it("should return ZcashAppCommandError for incorrect data", () => {
      const command = new GetAddressCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x6a, 0x80]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ZcashAppCommandError;
        expect(err.errorCode).toBe("6a80");
      }
    });

    it("should return InvalidStatusWordError when response data is empty", () => {
      const command = new GetAddressCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Public key length is missing",
        );
      }
    });

    it("should return InvalidStatusWordError when public key data is truncated", () => {
      const command = new GetAddressCommand(defaultArgs);
      const data = new Uint8Array([0x41, 0x01, 0x02]);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Public key is missing",
        );
      }
    });

    it("should return InvalidStatusWordError when address length is missing", () => {
      const command = new GetAddressCommand(defaultArgs);
      const data = new Uint8Array(1 + 65);
      data[0] = 65;
      data.fill(0xab, 1, 66);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Address length is missing",
        );
      }
    });

    it("should return InvalidStatusWordError when address data is truncated", () => {
      const command = new GetAddressCommand(defaultArgs);
      const data = new Uint8Array(1 + 65 + 1 + 5);
      data[0] = 65;
      data.fill(0xab, 1, 66);
      data[66] = 35;
      data.fill(0x61, 67, 72);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Address is missing",
        );
      }
    });

    it("should return InvalidStatusWordError when chain code is missing", () => {
      const command = new GetAddressCommand(defaultArgs);
      const addrBytes = new TextEncoder().encode(address);
      const data = new Uint8Array(1 + 65 + 1 + addrBytes.length + 10);
      let offset = 0;
      data[offset++] = 65;
      data.fill(0xab, offset, offset + 65);
      offset += 65;
      data[offset++] = addrBytes.length;
      data.set(addrBytes, offset);
      offset += addrBytes.length;
      data.fill(0xcd, offset, offset + 10);

      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: data.slice(0, offset + 10),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Chain code is missing",
        );
      }
    });

    it("should handle unknown non-success status code via GlobalCommandErrorHandler", () => {
      const command = new GetAddressCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x55, 0x15]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
