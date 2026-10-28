/**
 * Golden APDUs for every Solana command, plus the device responses of the
 * commands whose parsing is simplified later (GetPubKey, SignOffChain) and the
 * 9000-with-data acceptance of ProvideTransactionCheck (0x23).
 *
 * Every expected value is a literal: nothing is imported from the command
 * sources, so a wrong CLA / INS / P1 / P2 byte, a swapped chunk flag or a lost
 * ATA flag fails here even when a command's own test would not notice.
 *
 * Pinned: a refactor that has to edit this file is wrong by definition.
 */
import {
  type Apdu,
  ApduResponse,
  bufferToHexaString,
  type CommandResult,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { UserInputType } from "@api/model/TransactionResolutionContext";

import { DelayedSignTransactionCommand } from "./DelayedSignTransactionCommand";
import { FinalizeGenericClearSignCommand } from "./FinalizeGenericClearSignCommand";
import { GetAppConfigurationCommand } from "./GetAppConfigurationCommand";
import { GetChallengeCommand } from "./GetChallengeCommand";
import { GetPubKeyCommand } from "./GetPubKeyCommand";
import { PromptUiDisplayCommand } from "./PromptUiDisplayCommand";
import { ProvideAltResolutionCommand } from "./ProvideAltResolutionCommand";
import { ProvideEnumVariantCommand } from "./ProvideEnumVariantCommand";
import { ProvideInstructionDescriptorCommand } from "./ProvideInstructionDescriptorCommand";
import { ProvideInstructionInfoCommand } from "./ProvideInstructionInfoCommand";
import { ProvideInstructionSubstructureCommand } from "./ProvideInstructionSubstructureCommand";
import { ProvideTLVDescriptorCommand } from "./ProvideTLVDescriptorCommand";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "./ProvideTLVTransactionInstructionDescriptorCommand";
import { ProvideTokenAccountStateCommand } from "./ProvideTokenAccountStateCommand";
import { ProvideTransactionCheckCommand } from "./ProvideTransactionCheckCommand";
import { ProvideTrustedNameCommand } from "./ProvideTrustedNameCommand";
import { SignMessageGenericPreviewCommand } from "./SignMessageGenericPreviewCommand";
import { SignOffChainMessageCommand } from "./SignOffChainMessageCommand";
import { SignTransactionCommand } from "./SignTransactionCommand";
import { SignTransactionPreviewCommand } from "./SignTransactionPreviewCommand";
import { TransactionCheckOptInCommand } from "./TransactionCheckOptInCommand";

const rawHex = (apdu: Apdu): string =>
  bufferToHexaString(apdu.getRawApdu(), false);

const PAYLOAD = Uint8Array.of(0xaa, 0xbb, 0xcc);
const SIGNATURE_70_HEX = "11".repeat(70);

const response = (statusCode: number[], data: number[] = []): ApduResponse =>
  new ApduResponse({
    statusCode: Uint8Array.from(statusCode),
    data: Uint8Array.from(data),
  });

const errorOf = <T, E>(result: CommandResult<T, E>): unknown => {
  if (isSuccessCommandResult(result)) throw new Error("expected an error");
  return result.error;
};

const dataOf = <T, E>(result: CommandResult<T, E>): T => {
  if (!isSuccessCommandResult(result)) throw new Error("expected a success");
  return result.data;
};

describe("Command golden APDUs", () => {
  describe("commands without data", () => {
    it.each([
      [
        "0x04 getAppConfiguration",
        () => new GetAppConfigurationCommand(),
        "e004000000",
      ],
      [
        "0x0b promptUiDisplay",
        () => new PromptUiDisplayCommand(),
        "e00b000000",
      ],
      [
        "0x0c finalizeGenericClearSign",
        () => new FinalizeGenericClearSignCommand(),
        "e00c000000",
      ],
      ["0x20 getChallenge", () => new GetChallengeCommand(), "e020000000"],
    ])("%s", (_, build, expected) => {
      expect(rawHex(build().getApdu())).toBe(expected);
    });
  });

  describe("0x05 getPubKey", () => {
    it.each([
      [true, "e005010011048000002c800001f58000000080000000"],
      [false, "e005000011048000002c800001f58000000080000000"],
    ])("checkOnDevice=%s", (checkOnDevice, expected) => {
      const command = new GetPubKeyCommand({
        derivationPath: "44'/501'/0'/0'",
        checkOnDevice,
      });
      expect(rawHex(command.getApdu())).toBe(expected);
    });
  });

  describe("0x23 transactionCheckOptIn", () => {
    it("sends P1=0x01 with a single 0x00 byte", () => {
      expect(rawHex(new TransactionCheckOptInCommand().getApdu())).toBe(
        "e02301000100",
      );
    });
  });

  describe("signed descriptors (0x16, 0x22)", () => {
    it("0x16 ProvideInstructionDescriptor appends tag 0x15 and the signature", () => {
      const command = new ProvideInstructionDescriptorCommand({
        dataHex: "aabbcc",
        signatureHex: SIGNATURE_70_HEX,
      });
      expect(rawHex(command.getApdu())).toBe(
        `e01600004baabbcc1546${SIGNATURE_70_HEX}`,
      );
    });

    it("0x22 ProvideTLVTransactionInstructionDescriptor appends tag 0x08 and the signature", () => {
      const command = new ProvideTLVTransactionInstructionDescriptorCommand({
        dataHex: "aabbcc",
        signatureHex: SIGNATURE_70_HEX,
      });
      expect(rawHex(command.getApdu())).toBe(
        `e02200004baabbcc0846${SIGNATURE_70_HEX}`,
      );
    });
  });

  describe("chunked descriptors with optional flags (0x21, 0x24-0x29)", () => {
    const commands = [
      ["0x21 provideTLVDescriptor", "21", ProvideTLVDescriptorCommand],
      ["0x24 provideInstructionInfo", "24", ProvideInstructionInfoCommand],
      [
        "0x25 provideInstructionSubstructure",
        "25",
        ProvideInstructionSubstructureCommand,
      ],
      ["0x26 provideEnumVariant", "26", ProvideEnumVariantCommand],
      ["0x27 provideTokenAccountState", "27", ProvideTokenAccountStateCommand],
      ["0x28 provideAltResolution", "28", ProvideAltResolutionCommand],
      ["0x29 provideTrustedName", "29", ProvideTrustedNameCommand],
    ] as const;

    describe.each(commands)("%s", (_, ins, Command) => {
      it("defaults to a single chunk (P2=0x00)", () => {
        expect(rawHex(new Command({ payload: PAYLOAD }).getApdu())).toBe(
          `e0${ins}000003aabbcc`,
        );
      });

      it.each([
        ["single", true, false, "00"],
        ["first", true, true, "02"],
        ["middle", false, true, "03"],
        ["last", false, false, "01"],
      ])("%s chunk", (__, isFirstChunk, hasMore, p2) => {
        const command = new Command({
          payload: PAYLOAD,
          isFirstChunk,
          hasMore,
        });
        expect(rawHex(command.getApdu())).toBe(`e0${ins}00${p2}03aabbcc`);
      });

      it("accepts a 255-byte chunk and rejects a 256-byte one", () => {
        expect(
          rawHex(new Command({ payload: new Uint8Array(255) }).getApdu()),
        ).toBe(`e0${ins}0000ff${"00".repeat(255)}`);
        expect(() =>
          new Command({ payload: new Uint8Array(256) }).getApdu(),
        ).toThrow(
          expect.objectContaining({
            _tag: "ChunkTooLargeError",
            ins: parseInt(ins, 16),
            message: `Chunk too large for short APDU (INS=0x${ins}): 256 > 255`,
          }),
        );
      });
    });
  });

  describe("0x0a signMessageGenericPreview", () => {
    it.each([
      ["single", true, false, "00"],
      ["first", true, true, "02"],
      ["middle", false, true, "03"],
      ["last", false, false, "01"],
    ])("%s chunk", (_, isFirstChunk, hasMore, p2) => {
      const command = new SignMessageGenericPreviewCommand({
        serializedMessage: PAYLOAD,
        isFirstChunk,
        hasMore,
      });
      expect(rawHex(command.getApdu())).toBe(`e00a01${p2}03aabbcc`);
    });

    it("accepts a 255-byte chunk and rejects a 256-byte one", () => {
      const build = (size: number) =>
        new SignMessageGenericPreviewCommand({
          serializedMessage: new Uint8Array(size),
          isFirstChunk: true,
          hasMore: false,
        });
      expect(rawHex(build(255).getApdu())).toBe(
        `e00a0100ff${"00".repeat(255)}`,
      );
      expect(() => build(256).getApdu()).toThrow(
        expect.objectContaining({
          _tag: "ChunkTooLargeError",
          ins: 0x0a,
          message: "Chunk too large for short APDU (INS=0x0a): 256 > 255",
        }),
      );
    });
  });

  describe("0x23 provideTransactionCheck", () => {
    it.each([
      ["single", true, false, "00"],
      ["first", true, true, "02"],
      ["middle", false, true, "03"],
      ["last", false, false, "01"],
    ])("%s chunk", (_, isFirstChunk, hasMore, p2) => {
      const command = new ProvideTransactionCheckCommand({
        payload: PAYLOAD,
        isFirstChunk,
        hasMore,
      });
      expect(rawHex(command.getApdu())).toBe(`e02300${p2}03aabbcc`);
    });
  });

  describe("0x07 signOffChainMessage", () => {
    it.each([
      ["single", false, false, "00"],
      ["first", false, true, "02"],
      ["middle", true, true, "03"],
      ["last", true, false, "01"],
    ])("%s chunk", (_, extend, more, p2) => {
      const command = new SignOffChainMessageCommand({
        chunkedData: PAYLOAD,
        extend,
        more,
      });
      expect(rawHex(command.getApdu())).toBe(`e00701${p2}03aabbcc`);
    });
  });

  describe("sign commands with the ATA flag (0x06, 0x08, 0x09)", () => {
    const commands = [
      ["0x06 signTransaction", "06", SignTransactionCommand],
      ["0x08 signTransactionPreview", "08", SignTransactionPreviewCommand],
      ["0x09 delayedSignTransaction", "09", DelayedSignTransactionCommand],
    ] as const;

    describe.each(commands)("%s", (_, ins, Command) => {
      it.each([
        ["single", false, false, undefined, "00"],
        ["first", false, true, undefined, "02"],
        ["middle", true, true, undefined, "03"],
        ["last", true, false, undefined, "01"],
        ["single, SOL input", false, false, UserInputType.SOL, "00"],
        ["single, ATA input", false, false, UserInputType.ATA, "08"],
        ["first, ATA input", false, true, UserInputType.ATA, "0a"],
        ["middle, ATA input", true, true, UserInputType.ATA, "0b"],
        ["last, ATA input", true, false, UserInputType.ATA, "09"],
      ])("%s", (__, extend, more, userInputType, p2) => {
        const command = new Command({
          serializedTransaction: PAYLOAD,
          extend,
          more,
          userInputType,
        });
        expect(rawHex(command.getApdu())).toBe(`e0${ins}01${p2}03aabbcc`);
      });
    });
  });
});

describe("Command golden responses", () => {
  describe("0x05 getPubKey", () => {
    const command = () =>
      new GetPubKeyCommand({
        derivationPath: "44'/501'",
        checkOnDevice: false,
      });

    it("encodes a 32-byte key in base58", () => {
      const result = command().parseResponse(
        response([0x90, 0x00], new Array<number>(32).fill(0)),
      );
      expect(dataOf(result)).toBe("11111111111111111111111111111111");
    });

    it("reads only the first 32 bytes of a longer response", () => {
      const result = command().parseResponse(
        response([0x90, 0x00], [...new Array<number>(32).fill(0), 0xff]),
      );
      expect(dataOf(result)).toBe("11111111111111111111111111111111");
    });

    it.each([
      ["no data", []],
      ["31 bytes", new Array<number>(31).fill(0)],
    ])("fails on %s with 'Public key is missing'", (_, data) => {
      const result = command().parseResponse(response([0x90, 0x00], data));
      const error = errorOf(result) as {
        _tag: string;
        originalError: Error;
      };
      expect(error._tag).toBe("InvalidStatusWordError");
      expect(error.originalError.message).toBe("Public key is missing");
    });

    it("maps 6985 to a SolanaAppCommandError", () => {
      const result = command().parseResponse(response([0x69, 0x85]));
      expect(errorOf(result)).toMatchObject({
        _tag: "SolanaAppCommandError",
        errorCode: "6985",
        message: "Canceled by user",
      });
    });

    it("routes an unknown status word to the global handler", () => {
      const result = command().parseResponse(response([0x6f, 0x00]));
      expect(errorOf(result)).toMatchObject({
        _tag: "UnknownDeviceExchangeError",
        originalError: { message: "UnknownError", errorCode: "6f00" },
      });
    });
  });

  describe("0x07 signOffChainMessage", () => {
    const command = () =>
      new SignOffChainMessageCommand({
        chunkedData: PAYLOAD,
        extend: false,
        more: false,
      });

    it("returns a 64-byte signature", () => {
      const signature = new Array<number>(64).fill(0x42);
      const result = command().parseResponse(response([0x90, 0x00], signature));
      expect(dataOf(result)).toEqual(Uint8Array.from(signature));
    });

    it("reads only the first 64 bytes of a longer response", () => {
      const result = command().parseResponse(
        response([0x90, 0x00], [...new Array<number>(64).fill(0x42), 0xff]),
      );
      expect(dataOf(result)).toEqual(new Uint8Array(64).fill(0x42));
    });

    it.each([
      ["no data", []],
      ["63 bytes", new Array<number>(63).fill(0x42)],
    ])("returns empty data on %s", (_, data) => {
      const result = command().parseResponse(response([0x90, 0x00], data));
      expect(dataOf(result)).toEqual(new Uint8Array(0));
    });

    it("maps 6a81 to a SolanaAppCommandError", () => {
      const result = command().parseResponse(response([0x6a, 0x81]));
      expect(errorOf(result)).toMatchObject({
        _tag: "SolanaAppCommandError",
        errorCode: "6a81",
        message: "Invalid off-chain message header",
      });
    });
  });

  describe("0x23 provideTransactionCheck", () => {
    it("accepts 9000 with trailing data", () => {
      const result = new ProvideTransactionCheckCommand({
        payload: PAYLOAD,
        isFirstChunk: true,
        hasMore: false,
      }).parseResponse(response([0x90, 0x00], [0x01, 0x02]));
      expect(dataOf(result)).toBeUndefined();
    });
  });
});
