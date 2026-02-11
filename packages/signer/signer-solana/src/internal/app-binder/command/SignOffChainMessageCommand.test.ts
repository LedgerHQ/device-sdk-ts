import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  CLA,
  INS,
  P1,
  SignOffChainMessageCommand,
} from "./SignOffChainMessageCommand";

describe("SignOffChainMessageCommand", () => {
  const MESSAGE = new TextEncoder().encode("Solana SignOffChainMessage");
  const SIGNATURE_LENGTH = 64;

  describe("name", () => {
    it("should be 'signOffChainMessage'", () => {
      const command = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: false,
        more: false,
      });
      expect(command.name).toBe("signOffChainMessage");
    });
  });

  describe("getApdu()", () => {
    it("builds APDU for a single (final) chunk (p2=INIT)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: false,
        more: false,
      });

      const apdu = cmd.getApdu();

      const expected = new ApduBuilder({
        cla: CLA,
        ins: INS,
        p1: P1,
        p2: 0x00, // INIT only
      })
        .addBufferToData(MESSAGE)
        .build();

      expect(apdu.getRawApdu()).toEqual(expected.getRawApdu());
    });

    it("sets p2 correctly for first of many chunks (INIT|MORE)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: false,
        more: true,
      });

      const apdu = cmd.getApdu();

      const expected = new ApduBuilder({
        cla: CLA,
        ins: INS,
        p1: P1,
        p2: 0x02, // INIT|MORE
      })
        .addBufferToData(MESSAGE)
        .build();

      expect(apdu.getRawApdu()).toEqual(expected.getRawApdu());
    });

    it("sets p2 correctly for middle chunks (EXTEND|MORE)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: true,
        more: true,
      });

      const apdu = cmd.getApdu();

      const expected = new ApduBuilder({
        cla: CLA,
        ins: INS,
        p1: P1,
        p2: 0x03, // EXTEND|MORE
      })
        .addBufferToData(MESSAGE)
        .build();

      expect(apdu.getRawApdu()).toEqual(expected.getRawApdu());
    });

    it("sets p2 correctly for the final chunk after extends (EXTEND)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: true,
        more: false,
      });

      const apdu = cmd.getApdu();

      const expected = new ApduBuilder({
        cla: CLA,
        ins: INS,
        p1: P1,
        p2: 0x01, // EXTEND only
      })
        .addBufferToData(MESSAGE)
        .build();

      expect(apdu.getRawApdu()).toEqual(expected.getRawApdu());
    });
  });

  describe("parseResponse()", () => {
    it("returns raw 64-byte signature on the last chunk", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: true,
        more: false,
      });

      const signature = new Uint8Array(SIGNATURE_LENGTH).fill(0x42);

      const parsed = cmd.parseResponse(
        new ApduResponse({
          data: signature,
          statusCode: new Uint8Array([0x90, 0x00]),
        }),
      );

      expect(isSuccessCommandResult(parsed)).toBe(true);
      if (isSuccessCommandResult(parsed)) {
        expect(parsed.data).toEqual(signature);
      }
    });

    it("returns empty data for intermediate chunks (no signature yet)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: true,
        more: true,
      });

      const parsed = cmd.parseResponse(
        new ApduResponse({
          data: new Uint8Array(0), // device returns no data mid-stream
          statusCode: new Uint8Array([0x90, 0x00]),
        }),
      );

      expect(isSuccessCommandResult(parsed)).toBe(true);
      if (isSuccessCommandResult(parsed)) {
        expect(parsed.data).toEqual(new Uint8Array(0));
      }
    });

    it("returns empty data if signature is present but not 64 bytes", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: true,
        more: false,
      });

      const shortSig = new Uint8Array(SIGNATURE_LENGTH - 1).fill(0x99);

      const parsed = cmd.parseResponse(
        new ApduResponse({
          data: shortSig,
          statusCode: new Uint8Array([0x90, 0x00]),
        }),
      );

      expect(isSuccessCommandResult(parsed)).toBe(true);
      if (isSuccessCommandResult(parsed)) {
        expect(parsed.data).toEqual(new Uint8Array(0));
      }
    });

    it("returns error for known APDU error status words (e.g. 0x6a81)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: false,
        more: false,
      });

      const parsed = cmd.parseResponse(
        new ApduResponse({
          data: new Uint8Array(0),
          statusCode: new Uint8Array([0x6a, 0x81]),
        }),
      );

      expect(isSuccessCommandResult(parsed)).toBe(false);
      if (!isSuccessCommandResult(parsed)) {
        expect(parsed.error).toBeDefined();
        const err = parsed.error as { errorCode?: string };
        expect(err.errorCode).toBe("6a81");
      }
    });

    it("returns error for user cancellation (0x6982)", () => {
      const cmd = new SignOffChainMessageCommand({
        chunkedData: MESSAGE,
        extend: false,
        more: false,
      });

      const parsed = cmd.parseResponse(
        new ApduResponse({
          data: new Uint8Array(0),
          statusCode: new Uint8Array([0x69, 0x82]),
        }),
      );

      expect(isSuccessCommandResult(parsed)).toBe(false);
      if (!isSuccessCommandResult(parsed)) {
        expect(parsed.error).toBeDefined();
        const err = parsed.error as { errorCode?: string };
        expect(err.errorCode).toBe("6982");
      }
    });
  });
});
