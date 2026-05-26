import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { P2_EXTEND, P2_MORE } from "./utils/apduChunking";
import { ChunkTooLargeError } from "./utils/Errors";
import {
  CLA,
  INS,
  P1,
  SignMessageGenericPreviewCommand,
  type SignMessageGenericPreviewCommandArgs,
} from "./SignMessageGenericPreviewCommand";

describe("SignMessageGenericPreviewCommand", () => {
  const defaultArgs: SignMessageGenericPreviewCommandArgs = {
    serializedMessage: new Uint8Array(),
    isFirstChunk: true,
    hasMore: false,
  };

  describe("name", () => {
    it("should be 'signMessageGenericPreview'", () => {
      const command = new SignMessageGenericPreviewCommand(defaultArgs);
      expect(command.name).toBe("signMessageGenericPreview");
    });
  });

  describe("getApdu", () => {
    it("returns INS=0x0A, P1=0x01 and P2=0x00 for a single chunk", () => {
      const command = new SignMessageGenericPreviewCommand({
        serializedMessage: new Uint8Array([0x01, 0x02, 0x03]),
        isFirstChunk: true,
        hasMore: false,
      });

      const apdu = command.getApdu();

      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });

    it("sets P2_MORE on the first of many (isFirstChunk=true, hasMore=true)", () => {
      const command = new SignMessageGenericPreviewCommand({
        serializedMessage: new Uint8Array([0xaa]),
        isFirstChunk: true,
        hasMore: true,
      });
      expect(command.getApdu().p2).toBe(P2_MORE);
    });

    it("sets P2_EXTEND on the last chunk (isFirstChunk=false, hasMore=false)", () => {
      const command = new SignMessageGenericPreviewCommand({
        serializedMessage: new Uint8Array([0xaa]),
        isFirstChunk: false,
        hasMore: false,
      });
      expect(command.getApdu().p2).toBe(P2_EXTEND);
    });

    it("combines P2_MORE | P2_EXTEND for middle chunks", () => {
      const command = new SignMessageGenericPreviewCommand({
        serializedMessage: new Uint8Array([0xaa]),
        isFirstChunk: false,
        hasMore: true,
      });
      expect(command.getApdu().p2).toBe(P2_MORE | P2_EXTEND);
    });

    it("throws ChunkTooLargeError when the chunk exceeds APDU_MAX_PAYLOAD", () => {
      const command = new SignMessageGenericPreviewCommand({
        serializedMessage: new Uint8Array(256),
        isFirstChunk: true,
        hasMore: false,
      });
      expect(() => command.getApdu()).toThrow(ChunkTooLargeError);
    });
  });

  describe("parseResponse", () => {
    it("returns void on 9000 with empty payload", () => {
      const command = new SignMessageGenericPreviewCommand(defaultArgs);

      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(),
        }),
      );

      expect(result).toStrictEqual(CommandResultFactory({ data: undefined }));
    });

    it("rejects unexpected data on 9000", () => {
      const command = new SignMessageGenericPreviewCommand(defaultArgs);

      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0xff]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error result.error is narrowed by isSuccessCommandResult
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });

    it("surfaces a typed error on a non-success status word", () => {
      const command = new SignMessageGenericPreviewCommand(defaultArgs);

      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x80]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
