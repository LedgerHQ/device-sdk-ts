import {
  ApduResponse,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type AddressFormat } from "@api/model/AddressOptions";
import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { LegacyGetAddressCommand } from "./GetAddressCommand";

// m/84'/2'/0'/0/0: 5 path elements of 4 bytes, big endian
const LITECOIN_PATH_DATA = [
  "15",
  "05",
  "80000054",
  "80000002",
  "80000000",
  "00000000",
  "00000000",
].join("");

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

function buildSuccessResponse(
  publicKey: Uint8Array,
  address: string,
  chainCode: Uint8Array,
): ApduResponse {
  const addressBytes = new TextEncoder().encode(address);
  return new ApduResponse({
    statusCode: new Uint8Array([0x90, 0x00]),
    data: new Uint8Array([
      publicKey.length,
      ...publicKey,
      addressBytes.length,
      ...addressBytes,
      ...chainCode,
    ]),
  });
}

describe("LegacyGetAddressCommand", () => {
  const defaultArgs = { derivationPath: "84'/2'/0'/0/0" };

  it("should be named GetAddress", () => {
    const command = new LegacyGetAddressCommand(defaultArgs, BTC_LEGACY_ERRORS);
    expect(command.name).toBe("GetAddress");
  });

  describe("getApdu", () => {
    it("should default to the legacy format without display", () => {
      const command = new LegacyGetAddressCommand(
        defaultArgs,
        BTC_LEGACY_ERRORS,
      );
      expect(toHex(command.getApdu().getRawApdu())).toBe(
        "e0400000" + LITECOIN_PATH_DATA,
      );
    });

    it("should set P1 to display the address on the device", () => {
      const command = new LegacyGetAddressCommand(
        { ...defaultArgs, checkOnDevice: true },
        BTC_LEGACY_ERRORS,
      );
      expect(toHex(command.getApdu().getRawApdu())).toBe(
        "e0400100" + LITECOIN_PATH_DATA,
      );
    });

    it.each<[AddressFormat, string]>([
      ["legacy", "00"],
      ["p2sh", "01"],
      ["bech32", "02"],
      ["cashaddr", "03"],
    ])("should set P2 for the %s format", (addressFormat, p2) => {
      const command = new LegacyGetAddressCommand(
        { ...defaultArgs, addressFormat },
        BTC_LEGACY_ERRORS,
      );
      expect(toHex(command.getApdu().getRawApdu())).toBe(
        "e04000" + p2 + LITECOIN_PATH_DATA,
      );
    });

    it("should reject an address format the legacy protocol does not have", () => {
      const command = new LegacyGetAddressCommand(
        { ...defaultArgs, addressFormat: "bech32m" as AddressFormat },
        BTC_LEGACY_ERRORS,
      );
      expect(() => command.getApdu()).toThrow(
        "Unsupported address format: bech32m",
      );
    });
  });

  describe("parseResponse", () => {
    const command = new LegacyGetAddressCommand(defaultArgs, BTC_LEGACY_ERRORS);
    const publicKey = new Uint8Array(65).fill(0xab);
    const address = "ltc1q20ga3vdnev4zfzl6udrshg28dxev6e9w9lw70h";
    const chainCode = new Uint8Array(32).fill(0xcd);

    it("should return the public key, address and chain code", () => {
      const result = command.parseResponse(
        buildSuccessResponse(publicKey, address, chainCode),
      );

      expect(result).toStrictEqual({
        status: "SUCCESS",
        data: { publicKey, address, chainCode },
      });
    });

    it("should map a status word with the profile's errors", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: new Uint8Array([0x69, 0x85]),
          data: new Uint8Array(0),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(BtcLegacyAppCommandError);
        expect(result.error).toMatchObject({ errorCode: "6985" });
      }
    });

    it("should fail when the response is empty", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(0),
        }),
      );

      expect(result).toStrictEqual({
        status: "ERROR",
        error: new InvalidStatusWordError("Public key length is missing"),
      });
    });

    it("should fail when the public key is not uncompressed", () => {
      const result = command.parseResponse(
        buildSuccessResponse(new Uint8Array(33).fill(0x03), address, chainCode),
      );

      expect(result).toStrictEqual({
        status: "ERROR",
        error: new InvalidStatusWordError(
          "Expected a 65-byte public key, got 33 bytes",
        ),
      });
    });

    it("should fail when the chain code is truncated", () => {
      const result = command.parseResponse(
        buildSuccessResponse(publicKey, address, chainCode.slice(0, 16)),
      );

      expect(result).toStrictEqual({
        status: "ERROR",
        error: new InvalidStatusWordError("Chain code is missing"),
      });
    });
  });
});
