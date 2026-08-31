// Thin chunk-framer: wraps a pre-framed chunk under B0 10 04 <P2> and parses
// the 33-byte edit response (struct_type 0x32 + hmac_rest) on the final chunk.
// TLV byte-parity is asserted in SendEditExternalAddressScopeTask.test.ts.
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import {
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@internal/app-binder/model/contactsErrors";

import { EditExternalAddressScopeCommand } from "./EditExternalAddressScopeCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Device response: struct_type(0x32) + rotated hmac_rest(32).
const HMAC_REST = hexToBytes("88".repeat(32));
const RESPONSE_HEX = "32" + "88".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditExternalAddressScopeCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under B0 10 04 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x03, 0xaa, 0xbb, 0xcc]);

      const apdu = new EditExternalAddressScopeCommand({
        data,
        p2: 0x00,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xb0, 0x10, 0x04, 0x00, 0x05, 0x00, 0x03, 0xaa, 0xbb, 0xcc,
        ]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xaa, 0xbb]);

      const apdu = new EditExternalAddressScopeCommand({
        data,
        p2: 0x80,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x04, 0x80, 0x02, 0xaa, 0xbb]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns an empty payload for an intermediate chunk (SW=0x9000, no data)", () => {
      const result = new EditExternalAddressScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      }).parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]),
      });

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: {},
      });
    });

    it("extracts the rotated hmac_rest from the final-chunk response", () => {
      const command = new EditExternalAddressScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacRest: HMAC_REST },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + RESPONSE_HEX.slice(2); // replace 0x32 with 0xee
      const command = new EditExternalAddressScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("returns InvalidStatusWordError when hmac_rest is truncated", () => {
      const truncated = "32" + "88".repeat(16); // only 16 of 32 bytes
      const command = new EditExternalAddressScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(truncated));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985) to a ContactsCommandError", () => {
      const command = new EditExternalAddressScopeCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect(result.error).toBeInstanceOf(ContactsCommandError);
        expect((result.error as ContactsCommandError).errorCode).toBe("6985");
      }
    });

    it("maps SW=0x6982 to a seed-mismatch ContactsCommandError", () => {
      // The device returns 0x6982 when the seed-bound HMAC / group-handle
      // verification fails — i.e. the entry was registered with another seed.
      const command = new EditExternalAddressScopeCommand({
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
