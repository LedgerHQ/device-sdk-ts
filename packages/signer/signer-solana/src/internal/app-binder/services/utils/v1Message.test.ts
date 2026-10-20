import { getCompiledTransactionMessageDecoder } from "@solana/transaction-messages";

import {
  encodeV1Message,
  filledAddress,
  MAINNET_V1_MESSAGE_288,
  MAINNET_V1_MESSAGE_675,
  SPEC_V1_INPUT,
  SPEC_V1_MESSAGE,
  SPEC_V1_OFFSETS,
  u32le,
  withByte,
  withBytes,
  withTrailingBytes,
} from "@internal/app-binder/services/__test-utils__/v1Fixtures";

import { decodeV1Message, type V1Rule } from "./v1Message";

const VALID = "VALID";

const ruleOf = (bytes: Uint8Array): V1Rule | typeof VALID =>
  decodeV1Message(bytes).caseOf({
    Left: ({ rule }) => rule,
    Right: () => VALID,
  });

const SYSTEM_PROGRAM = filledAddress(0x00);
const TRANSFER = SPEC_V1_INPUT.instructions[0]!;
const PRIORITY_FEE_5000 = [0x88, 0x13, 0, 0, 0, 0, 0, 0];

/** The spec transfer with `count` signers, all writable. */
const withSigners = (count: number) =>
  encodeV1Message({
    ...SPEC_V1_INPUT,
    numSignerAccounts: count,
    addresses: [
      ...Array.from({ length: count }, (_, i) => filledAddress(i + 1)),
      SYSTEM_PROGRAM,
    ],
    instructions: [{ ...TRANSFER, programIndex: count }],
  });

/** The spec transfer with `count` addresses, the System program last. */
const withAddresses = (count: number) =>
  encodeV1Message({
    ...SPEC_V1_INPUT,
    addresses: [
      ...Array.from({ length: count - 1 }, (_, i) => filledAddress(i + 1)),
      SYSTEM_PROGRAM,
    ],
    instructions: [{ ...TRANSFER, programIndex: count - 1 }],
  });

/** The spec transfer repeated `count` times. */
const withInstructions = (count: number) =>
  encodeV1Message({
    ...SPEC_V1_INPUT,
    instructions: Array.from({ length: count }, () => TRANSFER),
  });

/** The spec message with the heap-size bit set to `heapSize`. */
const withHeapSize = (heapSize: number) =>
  encodeV1Message({
    ...SPEC_V1_INPUT,
    configMask: 0x1f,
    configValues: [
      ...Array.from(SPEC_V1_INPUT.configValues),
      ...u32le(heapSize),
    ],
  });

/** The spec transfer with `length` bytes of instruction data. */
const withDataLength = (length: number) =>
  encodeV1Message({
    ...SPEC_V1_INPUT,
    instructions: [{ ...TRANSFER, data: new Uint8Array(length) }],
  });

// 160 bytes come before the spec transfer's data, and one signature adds 64.
const MAX_SPEC_DATA_LENGTH = 4096 - 64 - 160;

describe("decodeV1Message", () => {
  describe("shared vectors", () => {
    it("decodes the spec worked example", () => {
      expect(decodeV1Message(SPEC_V1_MESSAGE).extract()).toEqual({
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

    it("decodes the 675-byte mainnet message", () => {
      expect(decodeV1Message(MAINNET_V1_MESSAGE_675).extract()).toMatchObject({
        configMask: 0x1c,
        configValues: [
          { kind: "u32", value: 802 },
          { kind: "u32", value: 384433 },
          { kind: "u32", value: 32768 },
        ],
        numStaticAccounts: 7,
        numInstructions: 3,
      });
    });

    it("decodes the 288-byte mainnet message", () => {
      expect(decodeV1Message(MAINNET_V1_MESSAGE_288).extract()).toMatchObject({
        configMask: 0x0c,
        configValues: [
          { kind: "u32", value: 151 },
          { kind: "u32", value: 1024 },
        ],
        numInstructions: 2,
      });
    });
  });

  describe("config mask", () => {
    const validMasks = [0x00, 0x03].flatMap((priorityFeeBits) =>
      [0x00, 0x04, 0x08, 0x0c, 0x10, 0x14, 0x18, 0x1c].map(
        (otherBits) => priorityFeeBits | otherBits,
      ),
    );

    it.each(validMasks)(
      "decodes every config value at the right offset for mask %i",
      (mask) => {
        const values = [
          ...(mask & 0x03 ? [{ kind: "u64", value: 5000n }] : []),
          ...(mask & 0x04 ? [{ kind: "u32", value: 450 }] : []),
          ...(mask & 0x08 ? [{ kind: "u32", value: 32768 }] : []),
          ...(mask & 0x10 ? [{ kind: "u32", value: 65536 }] : []),
        ];
        const bytes = encodeV1Message({
          ...SPEC_V1_INPUT,
          configMask: mask,
          configValues: [
            ...(mask & 0x03 ? PRIORITY_FEE_5000 : []),
            ...(mask & 0x04 ? u32le(450) : []),
            ...(mask & 0x08 ? u32le(32768) : []),
            ...(mask & 0x10 ? u32le(65536) : []),
          ],
        });

        expect(decodeV1Message(bytes).extract()).toMatchObject({
          configMask: mask,
          configValues: values,
          instructionPayloads: [
            {
              instructionAccountIndices: [0, 1],
              instructionData: Uint8Array.from(TRANSFER.data),
            },
          ],
        });
      },
    );

    it("checks the mask before trailing bytes, since Kit's offset is wrong for unknown bits", () => {
      const bytes = withTrailingBytes(
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.configMask, 0x2f),
        [0, 0, 0, 0, 0, 0, 0, 0],
      );

      expect(ruleOf(bytes)).toBe("CONFIG_MASK");
    });
  });

  describe("rules", () => {
    const { configMask, instructionHeaders, instructionPayloads } =
      SPEC_V1_OFFSETS;

    it.each<[string, Uint8Array, V1Rule | typeof VALID]>([
      // Rule 1
      ["empty input", new Uint8Array(), "VERSION"],
      ["legacy first byte", withByte(SPEC_V1_MESSAGE, 0, 0x01), "VERSION"],
      ["v0 version byte", withByte(SPEC_V1_MESSAGE, 0, 0x80), "VERSION"],
      ["version byte 0x82", withByte(SPEC_V1_MESSAGE, 0, 0x82), "VERSION"],
      ["version byte 0xff", withByte(SPEC_V1_MESSAGE, 0, 0xff), "VERSION"],
      // Rule 2
      [
        "as many readonly signers as signers",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.numReadonlySignerAccounts, 1),
        "READONLY_SIGNERS",
      ],
      [
        "no signer",
        withByte(SPEC_V1_MESSAGE, SPEC_V1_OFFSETS.numSignerAccounts, 0),
        "READONLY_SIGNERS",
      ],
      // Rule 3
      ["12 signers", withSigners(12), VALID],
      ["13 signers", withSigners(13), "SIGNATURE_COUNT"],
      // Rule 4
      ["64 instructions", withInstructions(64), VALID],
      ["65 instructions", withInstructions(65), "INSTRUCTION_COUNT"],
      // Rule 5
      ["64 addresses", withAddresses(64), VALID],
      ["65 addresses", withAddresses(65), "ADDRESS_COUNT"],
      [
        "addresses for exactly the signers and readonly non-signers",
        withByte(
          SPEC_V1_MESSAGE,
          SPEC_V1_OFFSETS.numReadonlyNonSignerAccounts,
          2,
        ),
        VALID,
      ],
      [
        "fewer addresses than signers plus readonly non-signers",
        withByte(
          SPEC_V1_MESSAGE,
          SPEC_V1_OFFSETS.numReadonlyNonSignerAccounts,
          3,
        ),
        "ADDRESS_COUNT",
      ],
      // Rule 6
      [
        "duplicate addresses",
        withBytes(
          SPEC_V1_MESSAGE,
          SPEC_V1_OFFSETS.addresses + 32,
          filledAddress(0x11),
        ),
        "DUPLICATE_ADDRESS",
      ],
      // Rule 7
      [
        "unknown mask bit 5",
        withByte(SPEC_V1_MESSAGE, configMask, 0x2f),
        "CONFIG_MASK",
      ],
      [
        "unknown mask bit 31",
        withByte(SPEC_V1_MESSAGE, configMask + 3, 0x80),
        "CONFIG_MASK",
      ],
      [
        "lone priority-fee bit 1",
        withByte(SPEC_V1_MESSAGE, configMask, 0x0e),
        "CONFIG_MASK",
      ],
      [
        "lone priority-fee bit 0",
        withByte(SPEC_V1_MESSAGE, configMask, 0x0d),
        "CONFIG_MASK",
      ],
      // Rule 8
      ["heap size 32768", withHeapSize(32768), VALID],
      ["heap size 65536", withHeapSize(65536), VALID],
      ["heap size 262144", withHeapSize(262144), VALID],
      ["heap size 0", withHeapSize(0), "HEAP_SIZE"],
      ["heap size 32767", withHeapSize(32767), "HEAP_SIZE"],
      ["heap size 33000", withHeapSize(33000), "HEAP_SIZE"],
      ["heap size 262145", withHeapSize(262145), "HEAP_SIZE"],
      ["heap size 263168", withHeapSize(263168), "HEAP_SIZE"],
      // Rule 9
      [
        "program index 1",
        withByte(SPEC_V1_MESSAGE, instructionHeaders, 1),
        VALID,
      ],
      [
        "program index 0",
        withByte(SPEC_V1_MESSAGE, instructionHeaders, 0),
        "PROGRAM_INDEX",
      ],
      [
        "program index equal to the address count",
        withByte(SPEC_V1_MESSAGE, instructionHeaders, 3),
        "PROGRAM_INDEX",
      ],
      [
        "account index of the last address",
        withByte(SPEC_V1_MESSAGE, instructionPayloads + 1, 2),
        VALID,
      ],
      [
        "account index equal to the address count",
        withByte(SPEC_V1_MESSAGE, instructionPayloads + 1, 3),
        "ACCOUNT_INDEX",
      ],
      // Rule 10
      [
        "one trailing byte",
        withTrailingBytes(SPEC_V1_MESSAGE, [0]),
        "TRAILING_BYTES",
      ],
      [
        "a wire transaction (message followed by its signature)",
        withTrailingBytes(SPEC_V1_MESSAGE, new Array<number>(64).fill(0x44)),
        "TRAILING_BYTES",
      ],
      // Rule 12
      [
        "4096 bytes with the signature",
        withDataLength(MAX_SPEC_DATA_LENGTH),
        VALID,
      ],
      [
        "4097 bytes with the signature",
        withDataLength(MAX_SPEC_DATA_LENGTH + 1),
        "MESSAGE_SIZE",
      ],
    ])("%s", (_, bytes, expected) => {
      expect(ruleOf(bytes)).toBe(expected);
    });

    it("accepts a message without instructions", () => {
      expect(ruleOf(withInstructions(0))).toBe(VALID);
    });

    it("explains the failure in its detail", () => {
      expect(
        decodeV1Message(withByte(SPEC_V1_MESSAGE, configMask, 0x2f)).extract(),
      ).toEqual({
        rule: "CONFIG_MASK",
        detail: "Unknown config bits in mask 0x2f.",
      });
    });
  });

  describe("truncation", () => {
    it.each([
      ["spec", SPEC_V1_MESSAGE],
      ["675-byte mainnet", MAINNET_V1_MESSAGE_675],
      ["288-byte mainnet", MAINNET_V1_MESSAGE_288],
    ])("refuses every cut of the %s message as TRUNCATED", (_, message) => {
      const unexpected = Array.from(
        { length: message.length - 1 },
        (__, i) => i + 1,
      )
        .map((cut) => ({ cut, rule: ruleOf(message.subarray(0, cut)) }))
        .filter(({ rule }) => rule !== "TRUNCATED");

      expect(unexpected).toEqual([]);
    });
  });

  describe("differential check against Kit", () => {
    // Deterministic PRNG (mulberry32), so a failure always reproduces.
    const random = (() => {
      let state = 0x5eed_0385;
      return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
      };
    })();
    const randomInt = (max: number) => Math.floor(random() * max);

    const mutate = (message: Uint8Array) => {
      const bytes = Uint8Array.from(message);
      for (let i = 1 + randomInt(3); i > 0; i--) {
        bytes[randomInt(bytes.length)] = randomInt(256);
      }
      return bytes;
    };

    it("never accepts a message Kit rejects, and agrees with Kit when it accepts", () => {
      const decoder = getCompiledTransactionMessageDecoder();
      const vectors = [
        SPEC_V1_MESSAGE,
        MAINNET_V1_MESSAGE_675,
        MAINNET_V1_MESSAGE_288,
      ];
      const mismatches: string[] = [];

      for (let i = 0; i < 3000; i++) {
        const bytes = mutate(vectors[i % vectors.length]!);
        let kit: { message: unknown; end: number } | null;
        try {
          const [message, end] = decoder.read(bytes, 0);
          kit = { message, end };
        } catch {
          kit = null;
        }

        decodeV1Message(bytes).ifRight((message) => {
          if (kit === null || kit.end !== bytes.length) {
            mismatches.push(
              `accepted what Kit rejects: ${Buffer.from(bytes).toString("hex")}`,
            );
          } else if (
            JSON.stringify(kit.message, bigintToString) !==
            JSON.stringify(message, bigintToString)
          ) {
            mismatches.push(
              `decoded differently: ${Buffer.from(bytes).toString("hex")}`,
            );
          }
        });
      }

      expect(mismatches).toEqual([]);
    });
  });
});

function bigintToString(_: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
