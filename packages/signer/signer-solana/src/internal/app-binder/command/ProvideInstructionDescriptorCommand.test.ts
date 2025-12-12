import {
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import {
  CLA,
  INS,
  P1,
  P2,
  ProvideInstructionDescriptorCommand,
  SIGNATURE_TAG,
} from "./ProvideInstructionDescriptorCommand";

const DATA_HEX = "f0cacc1a";
const DATA_BYTES = Uint8Array.from([0xf0, 0xca, 0xcc, 0x1a]);
const SIG_70_HEX = "01".repeat(70);
const SIG_70_LEN = 70;

const LC_DESCRIPTOR = DATA_BYTES.length + 1 + 1 + SIG_70_LEN;

describe("ProvideInstructionDescriptorCommand", () => {
  describe("getApdu", () => {
    it("builds the correct APDU with INS=0x16, P1=0x00, P2=0x00", () => {
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
      });

      const apdu = cmd.getApdu().getRawApdu();

      const header = [CLA, INS, P1, P2, LC_DESCRIPTOR];
      const payload = [
        ...DATA_BYTES,
        SIGNATURE_TAG,
        SIG_70_LEN,
        ...Uint8Array.from(Buffer.from(SIG_70_HEX, "hex")),
      ];

      const EXPECTED = Uint8Array.from([...header, ...payload]);
      expect(apdu).toStrictEqual(EXPECTED);
    });

    it("always uses signature tag 0x15", () => {
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
      });

      const apdu = cmd.getApdu().getRawApdu();
      const sigTagOffset = 5 + DATA_BYTES.length;
      expect(apdu[sigTagOffset]).toBe(SIGNATURE_TAG);
    });

    it("throws if signature is too short (<70 bytes)", () => {
      const tooShort = "ab".repeat(68);
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: tooShort,
      });

      expect(() => cmd.getApdu()).toThrow(/Invalid signature length/i);
    });

    it("throws if signature is too long (>72 bytes)", () => {
      const tooLong = "ab".repeat(73);
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: tooLong,
      });

      expect(() => cmd.getApdu()).toThrow(/Invalid signature length/i);
    });

    it("throws if signature hex has odd length", () => {
      const oddHex = "a".repeat(141);
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: oddHex,
      });

      expect(() => cmd.getApdu()).toThrow(/Invalid signature length/i);
    });

    it("throws if the total short-APDU payload would exceed 255 bytes", () => {
      const BIG_DATA_HEX = "f0".repeat(200);
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: BIG_DATA_HEX,
        signatureHex: SIG_70_HEX,
      });

      expect(() => cmd.getApdu()).toThrow(/payload too large/i);
    });
  });

  describe("parseResponse", () => {
    it("returns success when status is 0x9000 and no data", () => {
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
      });

      const parsed = cmd.parseResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      });
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("returns an app error when status code is not 0x9000", () => {
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
      });

      const result = cmd.parseResponse({
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      });
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("returns InvalidStatusWordError if response contains unexpected data", () => {
      const cmd = new ProvideInstructionDescriptorCommand({
        dataHex: DATA_HEX,
        signatureHex: SIG_70_HEX,
      });

      const result = cmd.parseResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      });
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error error is present on CommandErrorResult
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
