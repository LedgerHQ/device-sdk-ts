import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SignPltCommand } from "@internal/app-binder/command/SignPltCommand";
import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P1, P2 } from "@internal/app-binder/constants";

const SUCCESS = new Uint8Array([0x90, 0x00]);

function buildResponse(statusCode: Uint8Array, data = new Uint8Array()) {
  return new ApduResponse({ statusCode, data });
}

describe("SignPltCommand", () => {
  describe("getApdu", () => {
    it("should build the INIT frame with INS=0x27, P1=0x00 and P2=0x00", () => {
      const command = new SignPltCommand({
        p1: P1.PLT_INIT,
        p2: P2.NONE,
        data: new Uint8Array(80).fill(0x01),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[0]).toBe(LEDGER_CLA);
      expect(raw[1]).toBe(INS.SIGN_PLT);
      expect(raw[2]).toBe(P1.PLT_INIT);
      expect(raw[3]).toBe(P2.NONE);
      expect(raw[4]).toBe(80);
    });

    it("should build the CONT frame with P1=0x01", () => {
      const command = new SignPltCommand({
        p1: P1.PLT_CONT,
        p2: P2.NONE,
        data: new Uint8Array(9).fill(0xcc),
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw[1]).toBe(INS.SIGN_PLT);
      expect(raw[2]).toBe(P1.PLT_CONT);
      expect(raw[3]).toBe(P2.NONE);
    });

    // The command forwards P2 verbatim; choosing it per frame is the caller's
    // job, because the device accepts fee display only on INIT.
    it("should forward P2 to the APDU rather than pinning it", () => {
      const build = (p2: number) =>
        new SignPltCommand({ p1: P1.PLT_INIT, p2, data: new Uint8Array(4) })
          .getApdu()
          .getRawApdu()[3];

      expect(build(P2.NONE)).toBe(0x00);
      expect(build(P2.FEE_DISPLAY)).toBe(0x01);
    });

    it("should include the data in the APDU payload", () => {
      const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const command = new SignPltCommand({
        p1: P1.PLT_CONT,
        p2: P2.NONE,
        data,
      });

      const raw = command.getApdu().getRawApdu();

      expect(raw.slice(5)).toStrictEqual(data);
    });
  });

  describe("parseResponse", () => {
    it("should return an empty signature for INIT and intermediate CONT frames", () => {
      const command = new SignPltCommand({
        p1: P1.PLT_INIT,
        p2: P2.NONE,
        data: new Uint8Array(4),
      });

      const result = command.parseResponse(buildResponse(SUCCESS));

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(new Uint8Array());
      }
    });

    it("should extract the 64-byte signature from the final CONT frame", () => {
      const command = new SignPltCommand({
        p1: P1.PLT_CONT,
        p2: P2.NONE,
        data: new Uint8Array(9),
      });
      const signature = new Uint8Array(64).fill(0xab);

      const result = command.parseResponse(buildResponse(SUCCESS, signature));

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it.each([
      [[0x69, 0x85], ConcordiumErrorCodes.USER_REJECTED],
      [[0x55, 0x15], ConcordiumErrorCodes.LOCKED_DEVICE],
      [[0x6a, 0x80], ConcordiumErrorCodes.DATA_INVALID],
      [[0x6b, 0x00], ConcordiumErrorCodes.WRONG_P1_P2],
      [[0x6b, 0x01], ConcordiumErrorCodes.INVALID_STATE],
      [[0x6b, 0x02], ConcordiumErrorCodes.INVALID_PATH],
      [[0x6b, 0x03], ConcordiumErrorCodes.INVALID_PARAM],
      [[0x6b, 0x04], ConcordiumErrorCodes.INVALID_TRANSACTION],
      [[0x6b, 0x06], ConcordiumErrorCodes.BUFFER_OVERFLOW],
      [[0x6b, 0x07], ConcordiumErrorCodes.FAILED_CX_OPERATION],
      [[0x6b, 0x0d], ConcordiumErrorCodes.PLT_CBOR_ERROR],
      [[0x6b, 0x0e], ConcordiumErrorCodes.PLT_BUFFER_ERROR],
      [[0x6b, 0x0f], ConcordiumErrorCodes.PLT_DATA_ERROR],
      [[0x6b, 0x10], ConcordiumErrorCodes.PLT_MULTI_OP],
    ])("should map status word %s to a typed error", (statusCode, expected) => {
      const command = new SignPltCommand({
        p1: P1.PLT_CONT,
        p2: P2.NONE,
        data: new Uint8Array(4),
      });

      const result = command.parseResponse(
        buildResponse(new Uint8Array(statusCode)),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(
          (result.error as ConcordiumAppCommandError).errorCode,
        ).toStrictEqual(expected);
      }
    });
  });
});
