// EditContactNameCommand is the OS/dashboard rename command: a thin chunk-framer
// that wraps a pre-framed chunk (2-byte BE length prefix + TLV, assembled by
// SendEditContactNameTask + sendFramedContactsPayload) under B0-reserved-free
// CLA 0xE0 / INS 0x2E / P1 0x00, and parses the 33-byte response (struct_type
// 0x2e + rotated hmac_name) on the final chunk. Verified on-device (Flex, BOLOS
// 1.7.0-rc2); see the E0 2E probe in the Contacts port notes.
import { CommandResultStatus } from "@api/command/model/CommandResult";
import {
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@api/contacts/ContactsErrors";
import { type ApduResponse } from "@api/device-session/ApduResponse";

import { EditContactNameCommand } from "./EditContactNameCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Response is unchanged by the OS move: struct_type(0x2e) + rotated hmac_name(32).
const RESPONSE_HEX = "2e" + "77".repeat(32);
const HMAC_NAME_HEX = "77".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditContactNameCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under E0 2E 00 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x02, 0xaa, 0xbb]);

      const apdu = new EditContactNameCommand({ data, p2: 0x00 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x2e, 0x00, 0x00, 0x04, 0x00, 0x02, 0xaa, 0xbb]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xcc]);

      const apdu = new EditContactNameCommand({ data, p2: 0x80 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x2e, 0x00, 0x80, 0x01, 0xcc]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns an empty payload for an intermediate chunk (SW=0x9000, no data)", () => {
      const result = new EditContactNameCommand({
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

    it("extracts the rotated hmac_name from a successful response", () => {
      const command = new EditContactNameCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacNameHex: HMAC_NAME_HEX },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + RESPONSE_HEX.slice(2); // replace 0x2e with 0xee
      const command = new EditContactNameCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("surfaces a non-9000 SW as a contacts/global error", () => {
      const command = new EditContactNameCommand({
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
      // The device returns 0x6982 (before showing any UI) only when the
      // seed-bound HMAC verification fails — i.e. the contact was registered
      // with a different seed.
      const command = new EditContactNameCommand({
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
