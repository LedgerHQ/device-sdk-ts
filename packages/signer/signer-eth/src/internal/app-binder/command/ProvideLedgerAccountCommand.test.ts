// Byte-level parity with the playground fixture at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - send_eth_with_both_provides → exchange 0 (Provide Ledger Account, P1=0x21)
//     "Vault" with frame length 0x004d (77-byte TLV).
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { ProvideLedgerAccountCommand } from "./ProvideLedgerAccountCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// send_eth_with_both_provides[0].request_hex — full APDU.
// Header `b0 10 21 00 4f` + 2-byte frame length `00 4d` + 77-byte TLV payload.
const PROVIDE_LEDGER_ACCOUNT_REQUEST = hexToBytes(
  "b01021004f" +
    "004d" +
    "010134" +
    "020101" +
    "81f0055661756c74" +
    "69" +
    "15" +
    "058000002c8000003c800000000000000000000000" +
    "230101" +
    "510101" +
    "2920" +
    "ee".repeat(32),
);

const APDU_HEADER_LENGTH = 5;

function makeOkResponse(): ApduResponse {
  return {
    data: Buffer.from([]),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("ProvideLedgerAccountCommand", () => {
  describe("getApdu", () => {
    it("frames the single-chunk payload byte-equal to the fixture", () => {
      const command = new ProvideLedgerAccountCommand({
        data: PROVIDE_LEDGER_ACCOUNT_REQUEST.slice(APDU_HEADER_LENGTH),
        p2: 0x00,
      });

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        PROVIDE_LEDGER_ACCOUNT_REQUEST,
      );
    });

    it("uses P2=0x80 when called for a continuation chunk", () => {
      const command = new ProvideLedgerAccountCommand({
        data: new Uint8Array([0xaa, 0xbb]),
        p2: 0x80,
      });

      const raw = command.getApdu().getRawApdu();
      expect(raw[0]).toBe(0xb0);
      expect(raw[1]).toBe(0x10);
      expect(raw[2]).toBe(0x21);
      expect(raw[3]).toBe(0x80);
    });
  });

  describe("parseResponse", () => {
    it("returns empty data on the silent 0x9000 ack", () => {
      const command = new ProvideLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeOkResponse());

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: {},
      });
    });

    it("surfaces a non-9000 SW via the eth-app error helper", () => {
      const command = new ProvideLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("surfaces an authentication-failure SW (0x6982) via the eth-app error helper", () => {
      const command = new ProvideLedgerAccountCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x82]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });
  });
});
