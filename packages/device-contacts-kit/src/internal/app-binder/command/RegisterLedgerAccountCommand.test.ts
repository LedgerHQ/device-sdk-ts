// RegisterLedgerAccountCommand is a thin chunk-framer: it wraps a pre-framed
// chunk (2-byte BE length prefix + TLV, assembled by
// SendRegisterLedgerAccountTask + sendFramedContactsPayload) under B0 10 11
// <P2>, and parses the 33-byte register response (struct_type + hmac_proof) on
// the final chunk. TLV byte-parity is asserted in
// SendRegisterLedgerAccountTask.test.ts.
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { ContactsCommandError } from "@internal/app-binder/model/contactsErrors";

import { RegisterLedgerAccountCommand } from "./RegisterLedgerAccountCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Device response: struct_type(0x2f) + hmac_proof(32).
const HMAC_PROOF = hexToBytes("dd".repeat(32));
const RESPONSE_HEX = "2f" + "dd".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("RegisterLedgerAccountCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under B0 10 11 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x03, 0xaa, 0xbb, 0xcc]);

      const apdu = new RegisterLedgerAccountCommand({
        data,
        p2: 0x00,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xb0, 0x10, 0x11, 0x00, 0x05, 0x00, 0x03, 0xaa, 0xbb, 0xcc,
        ]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xaa, 0xbb]);

      const apdu = new RegisterLedgerAccountCommand({
        data,
        p2: 0x80,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x11, 0x80, 0x02, 0xaa, 0xbb]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns an empty payload for an intermediate chunk (SW=0x9000, no data)", () => {
      const result = new RegisterLedgerAccountCommand({
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

    it("extracts hmac_proof from a register response", () => {
      const command = new RegisterLedgerAccountCommand({
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
      const wrongType = "ee" + RESPONSE_HEX.slice(2); // replace 0x2f with 0xee
      const command = new RegisterLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("returns InvalidStatusWordError when hmac_proof is truncated", () => {
      const truncated = "2f" + "dd".repeat(16); // only 16 of 32 proof bytes
      const command = new RegisterLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(truncated));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985) to a ContactsCommandError", () => {
      const command = new RegisterLedgerAccountCommand({
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
  });
});
