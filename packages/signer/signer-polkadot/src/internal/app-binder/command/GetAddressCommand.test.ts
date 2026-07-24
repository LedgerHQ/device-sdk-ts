import {
  ApduBuilder,
  ApduResponse,
  type InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { describe, expect, it } from "vitest";

import {
  GetAddressCommand,
  P1_CONFIRM,
  P1_NO_CONFIRM,
  polkadotGetAddressApduHeader,
} from "@internal/app-binder/command/GetAddressCommand";
import {
  PolkadotAppCommandError,
  PolkadotErrorCodes,
} from "@internal/app-binder/command/utils/polkadotApplicationErrors";

const POLKADOT_PATH = "44'/354'/0'/0'/0'";
const SS58_PREFIX = 42;

/**
 * Encodes a derivation path to the Polkadot 20-byte LE format.
 * Passthrough — all elements written as-is (hardened flag preserved).
 */
const pathToBuffer = (derivationPath: string): Uint8Array => {
  const paths = DerivationPathUtils.splitPath(derivationPath);
  const view = new DataView(new ArrayBuffer(20));
  for (let i = 0; i < paths.length; i++) {
    view.setUint32(i * 4, paths[i]! >>> 0, true);
  }
  return new Uint8Array(view.buffer);
};

const ss58ToBuffer = (prefix: number): Uint8Array => {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, prefix, true);
  return buf;
};

describe("GetAddressCommand", () => {
  describe("name", () => {
    it("should be 'GetAddress'", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: false,
      });
      // ASSERT
      expect(command.name).toBe("GetAddress");
    });
  });

  describe("getApdu", () => {
    it("should return APDU with P1=0x00 when checkOnDevice is false", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: false,
      });
      const expected = new ApduBuilder(
        polkadotGetAddressApduHeader(P1_NO_CONFIRM),
      )
        .addBufferToData(pathToBuffer(POLKADOT_PATH))
        .addBufferToData(ss58ToBuffer(SS58_PREFIX));
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should return APDU with P1=0x01 when checkOnDevice is true", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: true,
      });
      const expected = new ApduBuilder(polkadotGetAddressApduHeader(P1_CONFIRM))
        .addBufferToData(pathToBuffer(POLKADOT_PATH))
        .addBufferToData(ss58ToBuffer(SS58_PREFIX));
      // ACT
      const apdu = command.getApdu();
      // ASSERT
      expect(apdu.getRawApdu()).toStrictEqual(expected.build().getRawApdu());
    });

    it("should encode SS58 prefix as 2-byte little-endian", () => {
      // ARRANGE — SS58=42 (0x002A): LE bytes = [0x2A, 0x00]
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: 42,
        checkOnDevice: false,
      });
      // ACT
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();
      // The payload starts at byte 5 (CLA INS P1 P2 Lc), path is 20 bytes, then SS58 at offset 25+5=25
      // raw[0..4] = header, raw[5] = Lc, raw[6..25] = path (20 bytes), raw[26..27] = SS58
      // Actually ApduBuilder format: CLA(1) INS(1) P1(1) P2(1) Lc(1) data...
      const dataOffset = 5; // after CLA INS P1 P2 Lc
      const ss58Offset = dataOffset + 20; // after path
      expect(raw[ss58Offset]).toBe(0x2a); // 42 LSB
      expect(raw[ss58Offset + 1]).toBe(0x00); // 42 MSB
    });

    it("should throw when derivation path does not have 5 elements", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: "44'/354'/0'",
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: false,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "GetAddressCommand: expected 5 path elements, got 3",
      );
    });

    it("should throw when ss58Prefix exceeds the uint16 range", () => {
      // ARRANGE
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: 0x10000,
        checkOnDevice: false,
      });
      // ACT & ASSERT
      expect(() => command.getApdu()).toThrow(
        "GetAddressCommand: ss58Prefix must be a uint16",
      );
    });
  });

  describe("parseResponse", () => {
    it("should return publicKey and address on success (0x9000)", () => {
      // ARRANGE
      const publicKey = new Uint8Array(32).fill(0x02);
      const addressStr = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
      const addressBytes = new TextEncoder().encode(addressStr);
      const data = new Uint8Array(32 + addressBytes.length);
      data.set(publicKey, 0);
      data.set(addressBytes, 32);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data.publicKey).toStrictEqual(publicKey);
        expect(result.data.address).toBe(addressStr);
      }
    });

    it("should return PolkadotAppCommandError when device returns DATA_INVALID (0x6984)", () => {
      // ARRANGE
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x84]),
        data: new Uint8Array(0),
      });
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: false,
      });
      // ACT
      const result = command.parseResponse(response);
      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(PolkadotAppCommandError);
        const err = result.error as PolkadotAppCommandError;
        expect(err.errorCode).toBe(PolkadotErrorCodes.DATA_INVALID);
      }
    });

    it("should return InvalidStatusWordError when public key is missing from response", () => {
      // ARRANGE — success status but empty data
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });
      const command = new GetAddressCommand({
        derivationPath: POLKADOT_PATH,
        ss58Prefix: SS58_PREFIX,
        checkOnDevice: false,
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
