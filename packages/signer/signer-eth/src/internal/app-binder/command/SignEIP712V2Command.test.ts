import { isSuccessCommandResult } from "@ledgerhq/device-management-kit";

import { SignEIP712V2Command } from "./SignEIP712V2Command";

describe("SignEIP712V2Command", () => {
  describe("getApdu", () => {
    // The derivation path travelled inside EIP712_VALUES, and the app rejects a
    // non-empty Lc, so the whole command is its header plus a zero length.
    it("should carry no input data at all", () => {
      const command = new SignEIP712V2Command();

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x0c, 0x00, 0x02, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should extract the signature", () => {
      const command = new SignEIP712V2Command();

      const result = command.parseResponse({
        data: Uint8Array.from([
          0x1c,
          ...Array<number>(32).fill(0xaa),
          ...Array<number>(32).fill(0xbb),
        ]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      });

      if (!isSuccessCommandResult(result)) {
        throw new Error("Expected a success");
      }
      expect(result.data).toStrictEqual({
        v: 0x1c,
        r: `0x${"aa".repeat(32)}`,
        s: `0x${"bb".repeat(32)}`,
      });
    });

    it("should surface the app refusing to sign an unprepared message", () => {
      const command = new SignEIP712V2Command();

      const result = command.parseResponse({
        data: Uint8Array.from([]),
        statusCode: Uint8Array.from([0x69, 0x86]), // command not allowed
      });

      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should fail when the response is truncated", () => {
      const command = new SignEIP712V2Command();

      const result = command.parseResponse({
        data: Uint8Array.from([0x1c, ...Array<number>(16).fill(0xaa)]),
        statusCode: Uint8Array.from([0x90, 0x00]),
      });

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
