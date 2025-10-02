import {
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "./ProvideTLVTransactionInstructionDescriptorCommand";

const CLA = 0xe0;
const INS = 0x16;
const P2 = 0x00;
const P1_FIRST = 0x00;
const P1_NEXT = 0x80;
const DATA_HEX = "f0cacc1a";
const DATA_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);
const SIG_70_HEX = "01".repeat(70);
const SIG_70_LEN = 70;
const SIG_TAG = 0x15;
const LC_DESCRIPTOR = DATA_BYTES.length + 1 + 1 + SIG_70_LEN; // 4 + 1 + 1 + 70 = 76 (0x4c)

describe("ProvideTLVTransactionInstructionDescriptorCommand", () => {
  describe("getApdu", () => {
    it('builds the correct APDU for kind: "empty" (Lc=0)', () => {
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "empty",
        isFirstMessage: true,
      });

      const apdu = cmd.getApdu().getRawApdu();
      const EXPECTED = Uint8Array.from([CLA, INS, P1_FIRST, P2, 0x00]);
      expect(apdu).toStrictEqual(EXPECTED);
    });

    it('builds the correct APDU for kind: "descriptor" on first message', () => {
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "descriptor",
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
        isFirstMessage: true,
      });

      const apdu = cmd.getApdu().getRawApdu();

      // header + Lc
      const header = [CLA, INS, P1_FIRST, P2, LC_DESCRIPTOR];
      // payload = data | 0x15 | <len> | <signature>
      const payload = [
        ...DATA_BYTES,
        SIG_TAG,
        SIG_70_LEN,
        ...Uint8Array.from(Buffer.from(SIG_70_HEX, "hex")),
      ];

      const EXPECTED = Uint8Array.from([...header, ...payload]);
      expect(apdu).toStrictEqual(EXPECTED);
    });

    it('uses P1=0x80 when isFirstMessage=false for "descriptor"', () => {
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "descriptor",
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
        isFirstMessage: false,
      });

      const apdu = cmd.getApdu().getRawApdu();
      expect(apdu[2]).toBe(P1_NEXT);
    });

    it("throws if signature is too short (<70 bytes)", () => {
      const tooShort = "ab".repeat(68); // 68 bytes
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "descriptor",
        dataHex: DATA_HEX,
        signatureHex: tooShort,
        isFirstMessage: true,
      });

      expect(() => cmd.getApdu()).toThrow(/Invalid signature length/i);
    });

    it("throws if signature is too long (>72 bytes)", () => {
      const tooLong = "ab".repeat(73); // 73 bytes
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "descriptor",
        dataHex: DATA_HEX,
        signatureHex: tooLong,
        isFirstMessage: true,
      });

      expect(() => cmd.getApdu()).toThrow(/Invalid signature length/i);
    });

    it("throws if signature hex has odd length", () => {
      // 141 hex chars -> 70.5 bytes
      const oddHex = "a".repeat(141);
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "descriptor",
        dataHex: DATA_HEX,
        signatureHex: oddHex,
        isFirstMessage: true,
      });

      expect(() => cmd.getApdu()).toThrow(/Invalid signature length/i);
    });

    it("throws if the total short-APDU payload would exceed 255 bytes", () => {
      const BIG_DATA_HEX = "f0".repeat(200);
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "descriptor",
        dataHex: BIG_DATA_HEX,
        signatureHex: SIG_70_HEX,
        isFirstMessage: true,
      });

      expect(() => cmd.getApdu()).toThrow(/payload too large/i);
    });
  });

  describe("parseResponse", () => {
    it("returns success when status is 0x9000 and no data", () => {
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "empty",
        isFirstMessage: true,
      });

      const LNX_RESPONSE_GOOD = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      const parsed = cmd.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("returns an app error when status code is not 0x9000", () => {
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "empty",
        isFirstMessage: true,
      });

      const LNX_RESPONSE_ERROR = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = cmd.parseResponse(LNX_RESPONSE_ERROR);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("returns InvalidStatusWordError if response contains unexpected data", () => {
      const cmd = new ProvideTLVTransactionInstructionDescriptorCommand({
        kind: "empty",
        isFirstMessage: true,
      });

      const LNX_RESPONSE_EXTRA = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = cmd.parseResponse(LNX_RESPONSE_EXTRA);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error error is present on CommandErrorResult
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
