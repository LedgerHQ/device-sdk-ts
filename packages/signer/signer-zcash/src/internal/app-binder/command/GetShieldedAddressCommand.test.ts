import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetShieldedAddressCommand } from "@internal/app-binder/command/GetShieldedAddressCommand";
import { ZCASH_CLA } from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";

const GET_SHIELDED_ADDRESS_INS = 0x51;

// 32'/133'/0' + 44'/133'/0'/0/0 — no display
const GET_SHIELDED_ADDRESS_APDU_NO_DISPLAY = Uint8Array.from([
  ZCASH_CLA,
  GET_SHIELDED_ADDRESS_INS,
  0x00, // P1 (no display)
  0x00, // P2
  0x22, // Lc: 1+12+1+20 = 34
  // Orchard path: 32'/133'/0'
  0x03,
  0x80,
  0x00,
  0x00,
  0x20, // 32'
  0x80,
  0x00,
  0x00,
  0x85, // 133'
  0x80,
  0x00,
  0x00,
  0x00, // 0'
  // Transparent path: 44'/133'/0'/0/0
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

// same paths — display on device
const GET_SHIELDED_ADDRESS_APDU_WITH_DISPLAY = Uint8Array.from([
  ZCASH_CLA,
  GET_SHIELDED_ADDRESS_INS,
  0x01, // P1 (display)
  0x00,
  0x22,
  0x03,
  0x80,
  0x00,
  0x00,
  0x20,
  0x80,
  0x00,
  0x00,
  0x85,
  0x80,
  0x00,
  0x00,
  0x00,
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

// 32'/133'/1' + 44'/133'/1'/0/0 — account 1, no display
const GET_SHIELDED_ADDRESS_APDU_ACCOUNT_1 = Uint8Array.from([
  ZCASH_CLA,
  GET_SHIELDED_ADDRESS_INS,
  0x00,
  0x00,
  0x22,
  0x03,
  0x80,
  0x00,
  0x00,
  0x20,
  0x80,
  0x00,
  0x00,
  0x85,
  0x80,
  0x00,
  0x00,
  0x01, // 1'
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
  0x01, // 1'
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
]);

// 32'/133'/0' + 44'/133'/0'/0/5 — proves address index is serialized
const GET_SHIELDED_ADDRESS_APDU_ADDR_INDEX_5 = Uint8Array.from([
  ZCASH_CLA,
  GET_SHIELDED_ADDRESS_INS,
  0x00,
  0x00,
  0x22,
  0x03,
  0x80,
  0x00,
  0x00,
  0x20,
  0x80,
  0x00,
  0x00,
  0x85,
  0x80,
  0x00,
  0x00,
  0x00,
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
  0x05, // address index = 5
]);

function buildSuccessResponse(address: string): ApduResponse {
  const addressBytes = new TextEncoder().encode(address);
  const data = new Uint8Array(2 + addressBytes.length);

  // u16 BE length prefix
  data[0] = (addressBytes.length >> 8) & 0xff;
  data[1] = addressBytes.length & 0xff;

  // UTF-8 address
  data.set(addressBytes, 2);

  return new ApduResponse({
    statusCode: new Uint8Array([0x90, 0x00]),
    data,
  });
}

describe("GetShieldedAddressCommand", () => {
  const defaultArgs = {
    transparentDerivationPath: "44'/133'/0'/0/0",
    orchardDerivationPath: "32'/133'/0'",
    checkOnDevice: false,
  };

  describe("name", () => {
    it("should be 'GetShieldedAddress'", () => {
      const command = new GetShieldedAddressCommand(defaultArgs);
      expect(command.name).toBe("GetShieldedAddress");
    });
  });

  describe("getApdu", () => {
    it("should return correct APDU with checkOnDevice false", () => {
      const command = new GetShieldedAddressCommand(defaultArgs);
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_SHIELDED_ADDRESS_APDU_NO_DISPLAY,
      );
    });

    it("should return correct APDU with checkOnDevice true", () => {
      const command = new GetShieldedAddressCommand({
        ...defaultArgs,
        checkOnDevice: true,
      });
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_SHIELDED_ADDRESS_APDU_WITH_DISPLAY,
      );
    });

    it("should return correct APDU with a 2 custom derivation path", () => {
      const args = {
        orchardDerivationPath: "32'/133'/1'",
        transparentDerivationPath: "44'/133'/1'/0/0",
        checkOnDevice: false,
      };
      const command = new GetShieldedAddressCommand(args);
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_SHIELDED_ADDRESS_APDU_ACCOUNT_1,
      );
    });

    it("should return correct APDU for 2 derivation paths", () => {
      const args = {
        ...defaultArgs,
        transparentDerivationPath: "44'/133'/0'/0/5",
      };
      const command = new GetShieldedAddressCommand(args);
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(
        GET_SHIELDED_ADDRESS_APDU_ADDR_INDEX_5,
      );
    });
  });

  describe("parseResponse", () => {
    // firmware test vector: test_get_orchard_uaddress_no_confirm in app-zcash/tests/standalone/test_pubkey_cmd.py
    const expectedAddress =
      "u1u2h4ce7e2cn3z4nzur95muq2dl4da9x8h8kdp2l80gm9nl9raj8zzpx79ycjnfvar4v5exea5pqr5y9qsnlp0cdunwf9yjjx5c4q7ar9";

    const response = buildSuccessResponse(expectedAddress);
    it("should return the unified address on success", () => {
      const command = new GetShieldedAddressCommand(defaultArgs);
      const res = command.parseResponse(response);

      expect(isSuccessCommandResult(res)).toBe(true);
      if (isSuccessCommandResult(res)) {
        expect(res.data.address).toEqual(expectedAddress);
      }
    });

    it("should return bad status when user rejected on device", () => {
      const command = new GetShieldedAddressCommand(defaultArgs);
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
    it("should return InvalidStatusWordError when response data is empty", () => {
      const command = new GetShieldedAddressCommand(defaultArgs);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(0),
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
    });
    it("should return InvalidStatusWordError when address data is truncated", () => {
      const command = new GetShieldedAddressCommand(defaultArgs);
      const data = new Uint8Array([0x00, 0x32, ...new Uint8Array(10)]); // claims 50 bytes, only 10
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data,
      });

      const result = command.parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
