import {
  ApduResponse,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SolanaAppCommandError } from "./utils/SolanaApplicationErrors";
import {
  CLA,
  INS,
  P1,
  P2,
  PromptUiDisplayCommand,
} from "./PromptUiDisplayCommand";

describe("PromptUiDisplayCommand", () => {
  const command = new PromptUiDisplayCommand();

  describe("name", () => {
    it("should be 'promptUiDisplay'", () => {
      expect(command.name).toBe("promptUiDisplay");
    });
  });

  describe("getApdu", () => {
    it("builds an empty-data APDU with CLA/INS/P1/P2 = 0xE0/0x0B/0x00/0x00", () => {
      const apdu = command.getApdu();

      expect(apdu.cla).toBe(CLA);
      expect(apdu.ins).toBe(INS);
      expect(apdu.p1).toBe(P1);
      expect(apdu.p2).toBe(P2);
      expect(apdu.data).toStrictEqual(new Uint8Array());
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([0xe0, 0x0b, 0x00, 0x00, 0x00]),
      );
    });
  });

  describe("parseResponse", () => {
    it("returns success on 9000 (user approved)", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: new Uint8Array(),
        }),
      );

      expect(result).toStrictEqual(CommandResultFactory({ data: undefined }));
    });

    it("maps 6985 to a typed Solana app error (user-refused / session incomplete)", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x69, 0x85]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error narrowed by isSuccessCommandResult
      expect(result.error).toBeInstanceOf(SolanaAppCommandError);
      // @ts-expect-error narrowed by isSuccessCommandResult
      expect(result.error.errorCode).toBe("6985");
    });

    it("maps 6A80 to a typed Solana app error (merge engine failure)", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x6a, 0x80]),
          data: new Uint8Array(),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error narrowed by isSuccessCommandResult
      expect(result.error).toBeInstanceOf(SolanaAppCommandError);
      // @ts-expect-error narrowed by isSuccessCommandResult
      expect(result.error.errorCode).toBe("6a80");
    });

    it("rejects unexpected data on 9000", () => {
      const result = command.parseResponse(
        new ApduResponse({
          statusCode: Uint8Array.from([0x90, 0x00]),
          data: Uint8Array.from([0x01]),
        }),
      );

      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error narrowed by isSuccessCommandResult
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
