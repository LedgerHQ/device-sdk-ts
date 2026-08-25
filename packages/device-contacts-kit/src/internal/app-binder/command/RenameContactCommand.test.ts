// RenameContactCommand is a thin chunk-framer for the OS/dashboard EDIT CONTACT
// NAME command: it wraps a pre-framed chunk (2-byte BE length prefix + TLV,
// assembled by SendRenameContactTask + sendFramedContactsPayload) under
// E0 2E 00 <P2>, and parses the 33-byte response on the final chunk. TLV
// byte-parity is asserted in SendRenameContactTask.test.ts.
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import {
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@internal/app-binder/model/contactsErrors";

import { RenameContactCommand } from "./RenameContactCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Device response: struct_type(0x2e) + rotated hmac_name(32).
const HMAC_PROOF = hexToBytes("dd".repeat(32));
const RESPONSE_HEX = "2e" + "dd".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("RenameContactCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under E0 2E 00 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x03, 0xaa, 0xbb, 0xcc]);

      const apdu = new RenameContactCommand({ data, p2: 0x00 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xe0, 0x2e, 0x00, 0x00, 0x05, 0x00, 0x03, 0xaa, 0xbb, 0xcc,
        ]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xaa, 0xbb]);

      const apdu = new RenameContactCommand({ data, p2: 0x80 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x2e, 0x00, 0x80, 0x02, 0xaa, 0xbb]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns an empty payload for an intermediate chunk (SW=0x9000, no data)", () => {
      const result = new RenameContactCommand({
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

    it("extracts the rotated hmac_name from an edit-contact-name response", () => {
      const command = new RenameContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacProof: HMAC_PROOF },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + RESPONSE_HEX.slice(2); // replace 0x2e with 0xee
      const command = new RenameContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("returns InvalidStatusWordError when hmac_name is truncated", () => {
      const truncated = "2e" + "dd".repeat(16); // only 16 of 32 bytes
      const command = new RenameContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(truncated));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985) to a ContactsCommandError", () => {
      const command = new RenameContactCommand({
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
      // The device verifies the supplied group handle + old-name proof against
      // the seed-derived key before any UI, and returns 0x6982 on a mismatch.
      const command = new RenameContactCommand({
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
