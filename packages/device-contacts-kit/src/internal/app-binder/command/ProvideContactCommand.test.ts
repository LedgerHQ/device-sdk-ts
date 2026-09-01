import { CommandResultStatus } from "@ledgerhq/device-management-kit";

import {
  CONTACT_SEED_MISMATCH_ERROR_CODE,
  ContactsCommandError,
} from "@internal/app-binder/model/contactsErrors";

import { ProvideContactCommand } from "./ProvideContactCommand";

describe("ProvideContactCommand", () => {
  describe("getApdu", () => {
    it("wraps the framed chunk under B0 10 20 with P2=0x00 for the first/only chunk", () => {
      const data = Uint8Array.from([0x00, 0x03, 0xaa, 0xbb, 0xcc]);

      const apdu = new ProvideContactCommand({ data, p2: 0x00 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xb0, 0x10, 0x20, 0x00, 0x05, 0x00, 0x03, 0xaa, 0xbb, 0xcc,
        ]),
      );
    });

    it("uses P2=0x80 for continuation chunks", () => {
      const data = Uint8Array.from([0xaa, 0xbb]);

      const apdu = new ProvideContactCommand({ data, p2: 0x80 }).getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xb0, 0x10, 0x20, 0x80, 0x02, 0xaa, 0xbb]),
      );
    });
  });

  describe("parseResponse", () => {
    it("succeeds with no data on SW=0x9000", () => {
      const result = new ProvideContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      }).parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]),
      });

      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data: undefined,
      });
    });

    it("maps SW=0x6982 to a seed-mismatch ContactsCommandError", () => {
      const result = new ProvideContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      }).parseResponse({
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

    it("maps SW=0x6a80 to a ContactsCommandError", () => {
      const result = new ProvideContactCommand({
        data: new Uint8Array(),
        p2: 0x00,
      }).parseResponse({
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6a, 0x80]),
      });

      expect(result.status).toBe(CommandResultStatus.Error);
      if (result.status === CommandResultStatus.Error) {
        expect((result.error as ContactsCommandError).errorCode).toBe("6a80");
      }
    });
  });
});
