// Byte-level parity with the playground fixture at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - edit_external_address  (Alice / Eth main address swap, single APDU)
import { CommandResultStatus } from "@ledgerhq/device-management-kit";
import { type ApduResponse } from "@ledgerhq/device-management-kit";

import { EditIdentifierCommand } from "./EditIdentifierCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Fixture: edit_external_address — request_hex (full APDU).
// 2-byte BE frame prefix `00 ec` (= 236 bytes payload) sits at offset 5.
const EDIT_IDENTIFIER_REQUEST = hexToBytes(
  "b0100300ee" +
    "00ec" +
    "010131" +
    "020101" +
    "81f005416c696365" +
    "81f108457468206d61696e" +
    "81f2145555555555555555555555555555555555555555" +
    "81f41400000000000000000000000000000000deadbeef" +
    "81f640" +
    "cc".repeat(64) +
    "21" +
    "15" +
    "058000002c8000003c800000000000000000000000" +
    "230101" +
    "2920" +
    "dd".repeat(32) +
    "81f720" +
    "aa".repeat(32) +
    "510101",
);

// Fixture: edit_external_address — response_hex (data only; SW stripped).
const EDIT_IDENTIFIER_RESPONSE_HEX = "31" + "88".repeat(32);
const EDIT_IDENTIFIER_HMAC_REST_HEX = "88".repeat(32);

const APDU_HEADER_LENGTH = 5;

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditIdentifierCommand", () => {
  describe("getApdu", () => {
    it("frames the single-chunk payload byte-equal to the fixture", () => {
      const command = new EditIdentifierCommand({
        data: EDIT_IDENTIFIER_REQUEST.slice(APDU_HEADER_LENGTH),
        p2: 0x00,
      });

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        EDIT_IDENTIFIER_REQUEST,
      );
    });

    it("uses P2=0x80 when called for a continuation chunk", () => {
      const command = new EditIdentifierCommand({
        data: new Uint8Array([0xaa, 0xbb]),
        p2: 0x80,
      });

      const raw = command.getApdu().getRawApdu();
      expect(raw[0]).toBe(0xb0);
      expect(raw[1]).toBe(0x10);
      expect(raw[2]).toBe(0x03);
      expect(raw[3]).toBe(0x80);
    });
  });

  describe("parseResponse", () => {
    it("extracts the rotated hmac_rest from the final-chunk response", () => {
      const command = new EditIdentifierCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(
        makeResponse(EDIT_IDENTIFIER_RESPONSE_HEX),
      );

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacRestHex: EDIT_IDENTIFIER_HMAC_REST_HEX },
      });
    });

    it("returns empty data for intermediate-chunk SW=9000 responses", () => {
      const command = new EditIdentifierCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]),
      });

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: {},
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + EDIT_IDENTIFIER_RESPONSE_HEX.slice(2);
      const command = new EditIdentifierCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("surfaces a non-9000 SW via the eth-app error helper", () => {
      const command = new EditIdentifierCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });
  });
});
