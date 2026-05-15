import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import {
  ALEO_CLA,
  INS,
  P1,
  P2_DEFAULT,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

// 70 bytes of 0xAA — minimal valid DER ECDSA signature length
const SIGNATURE_HEX = "aa".repeat(70); // 140 hex chars = 70 bytes
const DATA_HEX = "deadbeef"; // 4 bytes of descriptor data

const SUCCESS_RESPONSE = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: new Uint8Array(0),
});

describe("ProvideTokenInformationCommand", () => {
  let command: ProvideTokenInformationCommand;

  beforeEach(() => {
    command = new ProvideTokenInformationCommand({
      dataHex: DATA_HEX,
      signatureHex: SIGNATURE_HEX,
    });
    vi.clearAllMocks();
  });

  describe("name", () => {
    it("should be 'ProvideTokenInformation'", () => {
      expect(command.name).toBe("ProvideTokenInformation");
    });
  });

  describe("getApdu", () => {
    it("should produce APDU with CLA=0xE0, INS=0x08, P1=0x00, P2=0x00", () => {
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();
      expect(raw[0]).toBe(ALEO_CLA);
      expect(raw[1]).toBe(INS.PROVIDE_TOKEN);
      expect(raw[2]).toBe(P1.NO_CHECK);
      expect(raw[3]).toBe(P2_DEFAULT);
    });

    it("should embed descriptor data bytes before the signature tag", () => {
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();
      // raw: [CLA, INS, P1, P2, LC, ...data(4), 0x15, sigLen(70), ...sig(70)]
      const lcIndex = 4;
      expect(raw[lcIndex]).toBe(4 + 1 + 1 + 70); // LC = 76
      expect(raw[5]).toBe(0xde);
      expect(raw[6]).toBe(0xad);
      expect(raw[7]).toBe(0xbe);
      expect(raw[8]).toBe(0xef);
    });

    it("should include 0x15 tag at the correct position", () => {
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();
      // [CLA, INS, P1, P2, LC, data(4 bytes), 0x15, ...]
      const tagIndex = 5 + 4; // after header (5) + data bytes (4)
      expect(raw[tagIndex]).toBe(0x15);
    });

    it("should encode signature length byte after the tag", () => {
      const apdu = command.getApdu();
      const raw = apdu.getRawApdu();
      const sigLenIndex = 5 + 4 + 1; // after header + data + tag
      expect(raw[sigLenIndex]).toBe(70);
    });

    it("should throw for a signature that is too short (< 70 bytes)", () => {
      const shortSig = "aa".repeat(69); // 69 bytes
      const cmd = new ProvideTokenInformationCommand({
        dataHex: DATA_HEX,
        signatureHex: shortSig,
      });
      expect(() => cmd.getApdu()).toThrow("Invalid signature length: 69 bytes");
    });

    it("should throw for a signature that is too long (> 72 bytes)", () => {
      const longSig = "aa".repeat(73); // 73 bytes
      const cmd = new ProvideTokenInformationCommand({
        dataHex: DATA_HEX,
        signatureHex: longSig,
      });
      expect(() => cmd.getApdu()).toThrow("Invalid signature length: 73 bytes");
    });

    it("should throw if total payload exceeds 255 bytes", () => {
      const bigDataHex = "aa".repeat(200); // 200-byte descriptor
      const cmd = new ProvideTokenInformationCommand({
        dataHex: bigDataHex,
        signatureHex: SIGNATURE_HEX,
      });
      expect(() => cmd.getApdu()).toThrow(
        "Descriptor payload too large for short APDU",
      );
    });

    it("should accept a 72-byte signature (maximum valid DER size)", () => {
      const maxSig = "aa".repeat(72);
      const cmd = new ProvideTokenInformationCommand({
        dataHex: DATA_HEX,
        signatureHex: maxSig,
      });
      expect(() => cmd.getApdu()).not.toThrow();
    });
  });

  describe("parseResponse", () => {
    it("should return Right(undefined) on 0x9000 with empty data", () => {
      const result = command.parseResponse(SUCCESS_RESPONSE);
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBeUndefined();
      }
    });

    it("should return Left on non-success status word", () => {
      const errorResponse = new ApduResponse({
        statusCode: Uint8Array.from([0x6a, 0x86]),
        data: new Uint8Array(0),
      });
      const result = command.parseResponse(errorResponse);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toEqual(
          expect.objectContaining({
            _tag: "AleoAppCommandError",
            errorCode: "6a86",
            message: "Incorrect P1 or P2",
          }),
        );
      }
    });

    it("should return Left(InvalidStatusWordError) when response contains unexpected data", () => {
      const responseWithData = new ApduResponse({
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array([0x01]),
      });
      const result = command.parseResponse(responseWithData);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toEqual(
          expect.objectContaining({
            _tag: "InvalidStatusWordError",
            originalError: expect.objectContaining({
              message: "Unexpected data in response",
            }),
          }),
        );
      }
    });
  });
});
