// RegisterLedgerAccountCommand is a thin chunk-framer: it wraps a pre-framed
// chunk (2-byte BE length prefix + TLV, assembled by
// SendRegisterLedgerAccountTask + sendFramedContactsPayload) under B0 10 11
// <P2>, and parses the 33-byte response on the final chunk. TLV byte-parity is
// asserted in SendRegisterLedgerAccountTask.test.ts.
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { RegisterLedgerAccountCommand } from "./RegisterLedgerAccountCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Device response is unchanged: struct_type(0x2f) + hmac_proof(32).
const RESPONSE_HEX =
  "2feeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const HMAC_PROOF_HEX = "ee".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("RegisterLedgerAccountCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under B0 10 11 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x02, 0xaa, 0xbb]);

      const apdu = new RegisterLedgerAccountCommand({
        data,
        p2: 0x00,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x11, 0x00, 0x04, 0x00, 0x02, 0xaa, 0xbb]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xcc]);

      const apdu = new RegisterLedgerAccountCommand({
        data,
        p2: 0x80,
      }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x11, 0x80, 0x01, 0xcc]),
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

    it("extracts hmac_proof from a successful response", () => {
      const command = new RegisterLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacProofHex: HMAC_PROOF_HEX },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + RESPONSE_HEX.slice(2);
      const command = new RegisterLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985 user-cancel) to an EthAppCommandError", () => {
      const command = new RegisterLedgerAccountCommand({
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
