import {
  type CompiledTransactionMessage,
  getCompiledTransactionMessageDecoder,
  type V1CompiledTransactionMessage,
} from "@solana/transaction-messages";

import { UNSTAKE_MESSAGE } from "@internal/app-binder/services/__test-utils__/ambiguousMessages";
import {
  encodeV1Message,
  filledAddress,
  SPEC_V1_INPUT,
  SPEC_V1_MESSAGE,
  SPEC_V1_OFFSETS,
  u32le,
  withByte,
  withBytes,
  withTrailingBytes,
} from "@internal/app-binder/services/__test-utils__/v1Fixtures";

// Pins what the Kit decoder (`@solana/transaction-messages` 8.3.0, the
// runtime dependency the package already uses) does with v1 (SIMD-0385)
// messages. The v1 validator is built on this contract: it relies on the
// field names and the `read()` end offset below, and adds every check Kit
// skips. A Kit bump that changes any of this must fail here first.

// Kit error codes (`@solana/errors`), kept as literals on purpose.
const VERSION_NUMBER_NOT_SUPPORTED = 5663021;
const INVALID_CONFIG_MASK_PRIORITY_FEE_BITS = 5663028;
const CANNOT_DECODE_EMPTY_BYTE_ARRAY = 8078000;
const INVALID_BYTE_LENGTH = 8078001;

const decoder = getCompiledTransactionMessageDecoder();

const read = (bytes: Uint8Array): [CompiledTransactionMessage, number] =>
  decoder.read(bytes, 0);

const readV1 = (
  bytes: Uint8Array,
): { message: V1CompiledTransactionMessage; end: number } => {
  const [message, end] = read(bytes);
  if (message.version !== 1) {
    throw new Error(`expected a v1 message, got version ${message.version}`);
  }
  return { message, end };
};

const errorCodeOf = (decode: () => unknown): number | undefined => {
  try {
    decode();
  } catch (error) {
    return (error as { context?: { __code?: number } }).context?.__code;
  }
  return undefined;
};

describe("Kit v1 message decoder contract", () => {
  it("the fixture builder reproduces the spec message byte for byte", () => {
    expect(SPEC_V1_MESSAGE).toHaveLength(172);
    expect(encodeV1Message(SPEC_V1_INPUT)).toEqual(SPEC_V1_MESSAGE);
  });

  describe("spec worked example", () => {
    it("decodes every field the v1 mapping reads", () => {
      expect(readV1(SPEC_V1_MESSAGE).message).toEqual({
        version: 1,
        header: {
          numSignerAccounts: 1,
          numReadonlySignerAccounts: 0,
          numReadonlyNonSignerAccounts: 1,
        },
        configMask: 0x0f,
        configValues: [
          { kind: "u64", value: 5000n },
          { kind: "u32", value: 450 },
          { kind: "u32", value: 32768 },
        ],
        lifetimeToken: "CVDFLCAjXhVWiPXH9nTCTpCgVzmDVoiPzNJYuccr1dqB",
        numInstructions: 1,
        numStaticAccounts: 3,
        staticAccounts: [
          "29d2S7vB453rNYFdR5Ycwt7y9haRT5fwVwL9zTmBhfV2",
          "3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3",
          "11111111111111111111111111111111",
        ],
        instructionHeaders: [
          {
            programAccountIndex: 2,
            numInstructionAccounts: 2,
            numInstructionDataBytes: 12,
          },
        ],
        instructionPayloads: [
          {
            instructionAccountIndices: [0, 1],
            instructionData: new Uint8Array([
              2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0,
            ]),
          },
        ],
      });
    });

    it("read() ends exactly at the end of the message", () => {
      expect(readV1(SPEC_V1_MESSAGE).end).toBe(172);
    });
  });

  describe("version byte", () => {
    it.each([
      ["0x82", 0x82],
      ["0xff", 0xff],
    ])("throws on version byte %s", (_, versionByte) => {
      expect(
        errorCodeOf(() =>
          read(withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.version, versionByte)),
        ),
      ).toBe(VERSION_NUMBER_NOT_SUPPORTED);
    });

    it("decodes legacy and v0 bytes to a different shape, so callers must narrow on version 1", () => {
      const v0Message = Uint8Array.from([0x80, ...UNSTAKE_MESSAGE, 0]);

      const [legacy] = read(UNSTAKE_MESSAGE);
      const [v0] = read(v0Message);

      expect(legacy.version).toBe("legacy");
      expect(v0.version).toBe(0);
      for (const message of [legacy, v0]) {
        expect(message).toHaveProperty("instructions");
        expect(message).not.toHaveProperty("instructionHeaders");
      }
    });
  });

  describe("config mask", () => {
    it.each([
      ["bit 0 without bit 1", 0x0e],
      ["bit 1 without bit 0", 0x0d],
    ])("throws on a lone priority-fee bit (%s)", (_, mask) => {
      expect(
        errorCodeOf(() =>
          read(withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.configMask, mask)),
        ),
      ).toBe(INVALID_CONFIG_MASK_PRIORITY_FEE_BITS);
    });

    it("accepts unknown bits and reads no value for them", () => {
      const { message, end } = readV1(
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.configMask, 0x2f),
      );

      expect(message.configMask).toBe(0x2f);
      expect(message.configValues).toHaveLength(3);
      expect(end).toBe(172);
    });

    it.each([33000, 0, 1_000_000])(
      "decodes heap size %s without a range or multiple-of-1024 check",
      (heap) => {
        const bytes = encodeV1Message({
          ...SPEC_V1_INPUT,
          configMask: 0x1f,
          configValues: [
            ...Array.from(SPEC_V1_INPUT.configValues),
            ...u32le(heap),
          ],
        });

        const { message, end } = readV1(bytes);

        expect(message.configValues[3]).toEqual({ kind: "u32", value: heap });
        expect(end).toBe(bytes.length);
      },
    );
  });

  describe("spec validity rules Kit does not check", () => {
    const manyAddresses = Array.from({ length: 65 }, (_, i) =>
      filledAddress(i + 1),
    );
    // 160 bytes before the data, plus 64 for the one signature: 4097 bytes.
    const oversizedMessage = encodeV1Message({
      ...SPEC_V1_INPUT,
      instructions: [
        { programIndex: 2, accounts: [0, 1], data: new Uint8Array(3873) },
      ],
    });

    it.each([
      [
        "rule 2: as many readonly signers as signers",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.numReadonlySignerAccounts, 1),
      ],
      [
        "rule 2: no signer",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.numSignerAccounts, 0),
      ],
      [
        "rule 3: 13 signers",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.numSignerAccounts, 13),
      ],
      [
        "rule 4: 65 instructions",
        encodeV1Message({
          ...SPEC_V1_INPUT,
          instructions: Array.from(
            { length: 65 },
            () => SPEC_V1_INPUT.instructions[0]!,
          ),
        }),
      ],
      [
        "rule 5: 65 addresses",
        encodeV1Message({ ...SPEC_V1_INPUT, addresses: manyAddresses }),
      ],
      [
        "rule 5: fewer addresses than signers plus readonly non-signers",
        withByte(
          SPEC_V1_MESSAGE,
          SPEC_V1_OFFSETS.numReadonlyNonSignerAccounts,
          3,
        ),
      ],
      [
        "rule 6: duplicate addresses",
        withBytes(
          SPEC_V1_MESSAGE,
          SPEC_V1_OFFSETS.addresses + 32,
          filledAddress(0x11),
        ),
      ],
      [
        "rule 9: program index 0",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.instructionHeaders, 0),
      ],
      [
        "rule 9: program index out of range",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.instructionHeaders, 9),
      ],
      [
        "rule 9: account index out of range",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.instructionPayloads + 1, 9),
      ],
      [
        "rule 12: message larger than 4096 bytes minus the signatures",
        oversizedMessage,
      ],
    ])("decodes without error: %s", (_, bytes) => {
      expect(readV1(bytes).end).toBe(bytes.length);
    });

    it("rule 12 vector is one byte over the limit", () => {
      expect(oversizedMessage.length + 64).toBe(4097);
    });

    it("rule 10: ignores trailing bytes, and read() stops at the message end", () => {
      const bytes = withTrailingBytes(SPEC_V1_MESSAGE, [0]);

      expect(readV1(bytes).end).toBe(172);
    });
  });

  describe("truncation", () => {
    it("throws a codec error at every cut of the spec message", () => {
      const unexpected = Array.from({ length: 171 }, (_, i) => i + 1)
        .map((cut) => ({
          cut,
          code: errorCodeOf(() => read(SPEC_V1_MESSAGE.subarray(0, cut))),
        }))
        .filter(
          ({ code }) =>
            code !== CANNOT_DECODE_EMPTY_BYTE_ARRAY &&
            code !== INVALID_BYTE_LENGTH,
        );

      expect(unexpected).toEqual([]);
    });
  });
});
