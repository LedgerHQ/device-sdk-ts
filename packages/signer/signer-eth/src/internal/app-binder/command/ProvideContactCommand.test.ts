// Byte-level parity with the playground fixture at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - send_eth_with_both_provides → exchange 1 (Provide Contact, P1=0x20)
//     "Alice / Eth main" with frame length 0x00d5 (213-byte TLV).
import {
  type ApduResponse,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { ProvideContactCommand } from "./ProvideContactCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// send_eth_with_both_provides[1].request_hex — full APDU.
// Header `b0 10 20 00 d7` + 2-byte frame length `00 d5` + 213-byte TLV payload.
const PROVIDE_CONTACT_REQUEST = hexToBytes(
  "b0102000d7" +
    "00d5" +
    "010133" +
    "020101" +
    "81f005416c696365" +
    "81f108457468206d61696e" +
    "81f21400000000000000000000000000000000deadbeef" +
    "81f640" +
    "cc".repeat(64) +
    "21" +
    "15" +
    "058000002c8000003c800000000000000000000000" +
    "230101" +
    "510101" +
    "2920" +
    "dd".repeat(32) +
    "81f720" +
    "aa".repeat(32),
);

const APDU_HEADER_LENGTH = 5;

function makeOkResponse(): ApduResponse {
  return {
    data: Buffer.from([]),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("ProvideContactCommand", () => {
  describe("getApdu", () => {
    it("frames the single-chunk payload byte-equal to the fixture", () => {
      const command = new ProvideContactCommand({
        data: PROVIDE_CONTACT_REQUEST.slice(APDU_HEADER_LENGTH),
        p2: 0x00,
      });

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        PROVIDE_CONTACT_REQUEST,
      );
    });

    it("uses P2=0x80 when called for a continuation chunk", () => {
      const command = new ProvideContactCommand({
        data: new Uint8Array([0xaa, 0xbb]),
        p2: 0x80,
      });

      const raw = command.getApdu().getRawApdu();
      expect(raw[0]).toBe(0xb0);
      expect(raw[1]).toBe(0x10);
      expect(raw[2]).toBe(0x20);
      expect(raw[3]).toBe(0x80);
    });
  });

  describe("parseResponse", () => {
    it("returns empty data on the silent 0x9000 ack", () => {
      const command = new ProvideContactCommand({
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
      const command = new ProvideContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("surfaces a TLV-parser error (0x6a80) via the eth-app error helper", () => {
      const command = new ProvideContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6a, 0x80]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });
  });
});
