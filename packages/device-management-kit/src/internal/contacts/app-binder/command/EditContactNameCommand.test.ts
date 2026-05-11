// Byte-level parity with the playground fixture at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - rename_contact_one_apdu  (Alice → Alicia, single APDU)
import { CommandResultStatus } from "@api/command/model/CommandResult";
import { type ApduResponse } from "@api/device-session/ApduResponse";

import { EditContactNameCommand } from "./EditContactNameCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Fixture: rename_contact_one_apdu — request_hex
const RENAME_REQUEST = hexToBytes(
  "b01002009301012e02010181f006416c6963696181f305416c69636581f640cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc2115058000002c8000003c8000000000000000000000002920dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
);

// Fixture: rename_contact_one_apdu — response_hex (data only; SW stripped)
const RENAME_RESPONSE_HEX =
  "2e7777777777777777777777777777777777777777777777777777777777777777";
const RENAME_HMAC_NAME_HEX = "77".repeat(32);

const APDU_HEADER_LENGTH = 5; // CLA, INS, P1, P2, Lc

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("EditContactNameCommand", () => {
  describe("getApdu", () => {
    it("frames the rename payload byte-equal to fixture", () => {
      const command = new EditContactNameCommand({
        data: RENAME_REQUEST.slice(APDU_HEADER_LENGTH),
      });

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(RENAME_REQUEST);
    });
  });

  describe("parseResponse", () => {
    it("extracts the rotated hmac_name from a successful response", () => {
      const command = new EditContactNameCommand({ data: new Uint8Array() });

      const result = command.parseResponse(makeResponse(RENAME_RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: { hmacNameHex: RENAME_HMAC_NAME_HEX },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + RENAME_RESPONSE_HEX.slice(2); // replace 0x2e with 0xee
      const command = new EditContactNameCommand({ data: new Uint8Array() });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("surfaces a non-9000 SW via the global error handler", () => {
      const command = new EditContactNameCommand({ data: new Uint8Array() });

      const result = command.parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x69, 0x85]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
    });
  });
});
