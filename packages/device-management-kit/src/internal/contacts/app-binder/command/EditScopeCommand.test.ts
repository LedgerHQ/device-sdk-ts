// Byte-level parity with the playground fixture at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - edit_external_address_label  (Alice / Eth main → Eth cold, single APDU)
import { CommandResultStatus } from "@api/command/model/CommandResult";
import {
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@api/contacts/ContactsErrors";
import { type ApduResponse } from "@api/device-session/ApduResponse";

import { EditScopeCommand } from "./EditScopeCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Fixture: edit_external_address_label — request_hex (full APDU).
// 2-byte BE frame prefix `00 e0` (= 224 bytes payload) sits at offset 5
// (immediately after the CLA/INS/P1/P2/Lc header).
const EDIT_SCOPE_REQUEST = hexToBytes(
  "b0100400e2" +
    "00e0" +
    "010132" +
    "020101" +
    "81f005416c696365" +
    "81f10845746820636f6c64" +
    "81f21400000000000000000000000000000000deadbeef" +
    "81f508457468206d61696e" +
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

// Fixture: edit_external_address_label — response_hex (data only; SW stripped)
const EDIT_SCOPE_RESPONSE_HEX = "32" + "99".repeat(32);
const EDIT_SCOPE_HMAC_REST_HEX = "99".repeat(32);

const APDU_HEADER_LENGTH = 5; // CLA, INS, P1, P2, Lc

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditScopeCommand", () => {
  describe("getApdu", () => {
    it("frames the single-chunk payload byte-equal to the fixture", () => {
      const command = new EditScopeCommand({
        data: EDIT_SCOPE_REQUEST.slice(APDU_HEADER_LENGTH),
        p2: 0x00,
      });

      expect(command.getApdu().getRawApdu()).toStrictEqual(EDIT_SCOPE_REQUEST);
    });

    it("uses P2=0x80 when called for a continuation chunk", () => {
      const command = new EditScopeCommand({
        data: new Uint8Array([0xaa, 0xbb]),
        p2: 0x80,
      });

      const raw = command.getApdu().getRawApdu();
      // CLA INS P1 P2 Lc data...
      expect(raw[0]).toBe(0xb0);
      expect(raw[1]).toBe(0x10);
      expect(raw[2]).toBe(0x04);
      expect(raw[3]).toBe(0x80);
    });
  });

  describe("parseResponse", () => {
    it("extracts the rotated hmac_rest from the final-chunk response", () => {
      const command = new EditScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(
        makeResponse(EDIT_SCOPE_RESPONSE_HEX),
      );

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacRestHex: EDIT_SCOPE_HMAC_REST_HEX },
      });
    });

    it("returns empty data for intermediate-chunk SW=9000 responses", () => {
      const command = new EditScopeCommand({
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
      const wrongType = "ee" + EDIT_SCOPE_RESPONSE_HEX.slice(2);
      const command = new EditScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("surfaces a non-9000 SW as a contacts/global error", () => {
      const command = new EditScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps SW=0x6982 to a seed-mismatch ContactsCommandError", () => {
      // 0x6982 from an edit-scope operation means the seed-bound HMAC
      // verification failed — the entry was registered with a different seed.
      const command = new EditScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x82]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect(result.error).toBeInstanceOf(ContactsCommandError);
        expect((result.error as ContactsCommandError).errorCode).toBe(
          CONTACT_SEED_MISMATCH_ERROR_CODE,
        );
      }
    });
  });
});
