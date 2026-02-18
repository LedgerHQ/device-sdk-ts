import {
  ApduBuilder,
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  COSMOS_GET_ADDRESS_APDU_HEADER,
  GetAddressCommand,
  P1_CHECK_ON_DEVICE,
  P1_NO_CHECK_ON_DEVICE,
} from "@internal/app-binder/command/GetAddressCommand";
import {
  type CosmosAppCommandError,
  CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

describe("GetAddressCommand", () => {
  describe("name", () => {
    it("should be 'GetAddress'", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ASSERT
      expect(command.name).toBe("GetAddress");
    });
  });

  describe("getApdu", () => {
    const pathToBuffer = (derivationPath: string): Uint8Array => {
      const derivationPathArray = DerivationPathUtils.splitPath(derivationPath);
      const view = new DataView(new ArrayBuffer(20));
      for (let i = 0; i < derivationPathArray.length; i++) {
        const raw = derivationPathArray[i]! & 0x7fffffff;
        const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
        view.setUint32(i * 4, hardened, true);
      }
      return new Uint8Array(view.buffer);
    };

    it("should return APDU", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      const expected = new ApduBuilder(
        COSMOS_GET_ADDRESS_APDU_HEADER(P1_NO_CHECK_ON_DEVICE),
      )
        .encodeInLVFromAscii("cosmos")
        .addBufferToData(pathToBuffer("44'/118'/0'/0/0"));
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should return APDU with P1=0x01 when checkOnDevice is true", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
        checkOnDevice: true,
        skipOpenApp: false,
      });
      const expected = new ApduBuilder(
        COSMOS_GET_ADDRESS_APDU_HEADER(P1_CHECK_ON_DEVICE),
      )
        .encodeInLVFromAscii("cosmos")
        .addBufferToData(pathToBuffer("44'/118'/0'/0/0"));
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should throw error when wrong derivation path is provided", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0",
        hrp: "cosmos",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT & ASSERT
      expect(() => {
        command.getApdu();
      }).toThrow(
        "GetAddressCommand: expected cosmos style number of path elements, got 4",
      );
    });
  });

  describe("parseResponse", () => {
    it("should return publicKey and address on success", () => {
      // ARRANGE
      const publicKey = new Uint8Array(33).fill(0x01);
      const addressBytes = new TextEncoder().encode(
        "cosmos1hj5fvaa2cwgj3zyg5r0yrzr8urwtde4lhp6kn2",
      );
      const addressPadded = new Uint8Array(65);
      addressPadded.set(addressBytes);
      const data = new Uint8Array(33 + 65);
      data.set(publicKey, 0);
      data.set(addressPadded, 33);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toStrictEqual(publicKey);
        expect(result.data.address).toBe(
          "cosmos1hj5fvaa2cwgj3zyg5r0yrzr8urwtde4lhp6kn2",
        );
      }
    });

    it("should return CosmosAppCommandError", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array(98),
      });
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as CosmosAppCommandError;
        expect((err.originalError as { errorCode: string }).errorCode).toBe(
          CosmosErrorCodes.DATA_INVALID.slice(2),
        );
      }
    });

    it("should return InvalidStatusWordError when public key is missing", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });
      const command = new GetAddressCommand({
        derivationPath: "44'/118'/0'/0/0",
        hrp: "cosmos",
        checkOnDevice: false,
        skipOpenApp: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect((err.originalError as { message: string }).message).toBe(
          "Public key is missing",
        );
      }
    });
  });
});
