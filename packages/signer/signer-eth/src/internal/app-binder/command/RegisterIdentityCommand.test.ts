// Byte-level parity with the playground fixtures at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - register_external_address_first_time     (fresh contact, 77-byte payload)
//   - register_external_address_extends_existing (extension, 179-byte payload)
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { RegisterIdentityCommand } from "./RegisterIdentityCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Fixture: register_external_address_first_time
const FRESH_REQUEST = hexToBytes(
  "b01001004d01012d02010181f005416c69636581f108457468206d61696e81f21400000000000000000000000000000000deadbeef2115058000002c8000003c800000000000000000000000230101510101",
);

const FRESH_RESPONSE_HEX =
  "2dccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FRESH_GROUP_HANDLE_HEX = "cc".repeat(64);
const FRESH_HMAC_NAME_HEX = "dd".repeat(32);
const FRESH_HMAC_REST_HEX = "aa".repeat(32);

// Fixture: register_external_address_extends_existing
const EXTENSION_REQUEST = hexToBytes(
  "b0100100b301012d02010181f005416c69636581f108417262206d61696e81f21444444444444444444444444444444444444444442115058000002c8000003c8000000000000000000000002302a4b151010181f640cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc2920dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
);

const EXTENSION_RESPONSE_HEX =
  "2dccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd9999999999999999999999999999999999999999999999999999999999999999";
const EXTENSION_GROUP_HANDLE_HEX = "cc".repeat(64);
const EXTENSION_HMAC_NAME_HEX = "dd".repeat(32);
const EXTENSION_HMAC_REST_HEX = "99".repeat(32);

const APDU_HEADER_LENGTH = 5; // CLA, INS, P1, P2, Lc

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("RegisterIdentityCommand", () => {
  describe("getApdu", () => {
    it("frames the fresh-register payload byte-equal to fixture", () => {
      const command = new RegisterIdentityCommand({
        data: FRESH_REQUEST.slice(APDU_HEADER_LENGTH),
      });

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(FRESH_REQUEST);
    });

    it("frames the extension-register payload byte-equal to fixture", () => {
      const command = new RegisterIdentityCommand({
        data: EXTENSION_REQUEST.slice(APDU_HEADER_LENGTH),
      });

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(EXTENSION_REQUEST);
    });
  });

  describe("parseResponse", () => {
    it("extracts group_handle / hmac_name / hmac_rest from a fresh-register response", () => {
      const command = new RegisterIdentityCommand({ data: new Uint8Array() });

      const result = command.parseResponse(makeResponse(FRESH_RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: {
          groupHandleHex: FRESH_GROUP_HANDLE_HEX,
          hmacNameHex: FRESH_HMAC_NAME_HEX,
          hmacRestHex: FRESH_HMAC_REST_HEX,
        },
      });
    });

    it("extracts the fresh hmac_rest from an extension-register response, group_handle/hmac_name unchanged", () => {
      const command = new RegisterIdentityCommand({ data: new Uint8Array() });

      const result = command.parseResponse(
        makeResponse(EXTENSION_RESPONSE_HEX),
      );

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: {
          groupHandleHex: EXTENSION_GROUP_HANDLE_HEX,
          hmacNameHex: EXTENSION_HMAC_NAME_HEX,
          hmacRestHex: EXTENSION_HMAC_REST_HEX,
        },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + FRESH_RESPONSE_HEX.slice(2); // replace 0x2d with 0xee
      const command = new RegisterIdentityCommand({ data: new Uint8Array() });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985 user-cancel) to an EthAppCommandError", () => {
      const command = new RegisterIdentityCommand({ data: new Uint8Array() });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });
  });
});
