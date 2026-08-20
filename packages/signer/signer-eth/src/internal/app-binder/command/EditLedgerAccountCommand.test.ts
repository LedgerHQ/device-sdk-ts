// EditLedgerAccountCommand is a thin chunk-framer: it wraps a pre-framed chunk
// (2-byte BE length prefix + TLV, assembled by SendEditLedgerAccountTask +
// sendFramedContactsPayload) under B0 10 12 <P2>, and parses the 33-byte
// response (struct_type 0x30 + rotated hmac_proof) on the final chunk. TLV
// byte-parity is asserted in SendEditLedgerAccountTask.test.ts.
import {
  type ApduResponse,
  CommandResultStatus,
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@ledgerhq/device-management-kit";

import { EditLedgerAccountCommand } from "./EditLedgerAccountCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

const ROTATED_PROOF_HEX = "ab".repeat(32);
const RESPONSE_HEX = "30" + ROTATED_PROOF_HEX;

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditLedgerAccountCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under B0 10 12 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x02, 0xaa, 0xbb]);

      const apdu = new EditLedgerAccountCommand({ data, p2: 0x00 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x12, 0x00, 0x04, 0x00, 0x02, 0xaa, 0xbb]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xcc]);

      const apdu = new EditLedgerAccountCommand({ data, p2: 0x80 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x12, 0x80, 0x01, 0xcc]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns an empty payload for an intermediate chunk (SW=0x9000, no data)", () => {
      const result = new EditLedgerAccountCommand({
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

    it("extracts the rotated hmac_proof from a successful response", () => {
      const command = new EditLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacProofHex: ROTATED_PROOF_HEX },
      });
    });

    it("returns an error when struct_type is wrong", () => {
      const wrongType = "ee" + RESPONSE_HEX.slice(2);
      const command = new EditLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps SW=0x6982 to a seed-mismatch ContactsCommandError", () => {
      // The device returns 0x6982 (before showing any UI) only when the
      // seed-bound HMAC proof verification fails — i.e. the Ledger account was
      // registered with a different seed than the one currently connected.
      const command = new EditLedgerAccountCommand({
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

    it("maps a known SW (0x6985 user-cancel) to a ContactsCommandError", () => {
      const command = new EditLedgerAccountCommand({
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
      }
    });
  });
});
