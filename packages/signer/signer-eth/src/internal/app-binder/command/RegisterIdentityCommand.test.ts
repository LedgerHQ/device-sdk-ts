// RegisterIdentityCommand is a thin chunk-framer: it wraps a pre-framed chunk
// (2-byte BE length prefix + TLV, assembled by SendRegisterIdentityTask +
// sendFramedContactsPayload) under B0 10 01 <P2>, and parses the 129-byte
// register response on the final chunk. TLV byte-parity is asserted in
// SendRegisterIdentityTask.test.ts.
import {
  type ApduResponse,
  CommandResultStatus,
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@ledgerhq/device-management-kit";

import { RegisterIdentityCommand } from "./RegisterIdentityCommand";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Device response is unchanged by the protocol update:
// struct_type(0x2d) + group_handle(64) + hmac_name(32) + hmac_rest(32).
const RESPONSE_HEX =
  "2dccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GROUP_HANDLE_HEX = "cc".repeat(64);
const HMAC_NAME_HEX = "dd".repeat(32);
const HMAC_REST_HEX = "aa".repeat(32);

function makeResponse(hex: string): ApduResponse {
  return {
    data: Buffer.from(hexToBytes(hex)),
    statusCode: Buffer.from([0x90, 0x00]),
  };
}

describe("RegisterIdentityCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under B0 10 01 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x03, 0xaa, 0xbb, 0xcc]);

      const apdu = new RegisterIdentityCommand({ data, p2: 0x00 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xb0, 0x10, 0x01, 0x00, 0x05, 0x00, 0x03, 0xaa, 0xbb, 0xcc,
        ]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xaa, 0xbb]);

      const apdu = new RegisterIdentityCommand({ data, p2: 0x80 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x01, 0x80, 0x02, 0xaa, 0xbb]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns an empty payload for an intermediate chunk (SW=0x9000, no data)", () => {
      const result = new RegisterIdentityCommand({
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

    it("extracts group_handle / hmac_name / hmac_rest from a register response", () => {
      const command = new RegisterIdentityCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(RESPONSE_HEX));

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: {
          groupHandleHex: GROUP_HANDLE_HEX,
          hmacNameHex: HMAC_NAME_HEX,
          hmacRestHex: HMAC_REST_HEX,
        },
      });
    });

    it("returns InvalidStatusWordError when struct_type is wrong", () => {
      const wrongType = "ee" + RESPONSE_HEX.slice(2); // replace 0x2d with 0xee
      const command = new RegisterIdentityCommand({
        data: new Uint8Array(),
        p2: 0x00,
      });

      const result = command.parseResponse(makeResponse(wrongType));

      expect(result.status).toBe(CommandResultStatus.Error);
    });

    it("maps a known SW (0x6985) to a ContactsCommandError", () => {
      const command = new RegisterIdentityCommand({
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
      // Reached when extending an existing contact whose group handle was
      // registered with another seed (once the app verifies before the UI).
      const command = new RegisterIdentityCommand({
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
