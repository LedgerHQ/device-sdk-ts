import {
  AccountRole,
  appendTransactionMessageInstructions,
  blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getTransactionEncoder,
  type Instruction,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  setTransactionMessagePriorityFeeLamports,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";

import {
  SEND_WITH_MEMO_MESSAGE,
  UNSTAKE_MESSAGE,
  withOneSignature,
} from "./__test-utils__/ambiguousMessages";
import { SPEC_V1_MESSAGE, withByte } from "./__test-utils__/v1Fixtures";
import { TransactionInputNormaliser } from "./TransactionInputNormaliser";

type TransactionVersion = "legacy" | 0 | 1;

/**
 * Builds a real instruction via `@solana/kit`, with a random program address,
 * a random number of accounts, and random data bytes.
 */
async function buildRandomInstruction(): Promise<Instruction> {
  const program = await generateKeyPairSigner();
  const numAccounts = 1 + Math.floor(Math.random() * 3);
  const accounts = await Promise.all(
    Array.from({ length: numAccounts }, async () => ({
      address: (await generateKeyPairSigner()).address,
      role: AccountRole.WRITABLE,
    })),
  );
  const data = new Uint8Array(1 + Math.floor(Math.random() * 16));
  crypto.getRandomValues(data);
  return { programAddress: program.address, accounts, data };
}

/**
 * Builds and signs a real transaction of the given version via `@solana/kit`,
 * with 1-3 random instructions and (v1 only, optionally) a
 * `TransactionConfigMask` (priority fee + compute-unit limit) set. Returns
 * both the bare message bytes and the signed full-wire bytes (message + real
 * Ed25519 signature).
 */
async function buildRandomTransaction(
  version: TransactionVersion,
  options?: { withConfig?: boolean },
) {
  const feePayer = await generateKeyPairSigner();
  const blockhashHolder = await generateKeyPairSigner();
  const numInstructions = 1 + Math.floor(Math.random() * 3);
  const instructions = await Promise.all(
    Array.from({ length: numInstructions }, () => buildRandomInstruction()),
  );

  const message = pipe(
    createTransactionMessage({ version }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash(blockhashHolder.address),
          lastValidBlockHeight: 1000n,
        },
        m,
      ),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signedTx = await signTransactionMessageWithSigners(
    options?.withConfig && version === 1
      ? pipe(
          // `version === 1` does not narrow the message type.
          setTransactionMessagePriorityFeeLamports(
            5000n,
            message as typeof message & { version: 1 },
          ),
          (m) => setTransactionMessageComputeUnitLimit(200000, m),
        )
      : message,
  );
  const messageBytes = new Uint8Array(signedTx.messageBytes);
  const wireBytes = getTransactionEncoder().encode(signedTx) as Uint8Array;

  return { messageBytes, wireBytes };
}

/**
 * Builds a real transaction of the given version with exactly 2 required
 * signers (fee payer + one co-signer, both referenced by their
 * `TransactionSigner`, not just their address, so
 * `signTransactionMessageWithSigners` signs for both). Deterministic in signer
 * count (always 2), unlike `buildRandomTransaction` which only ever produces a
 * single (fee-payer) signer.
 */
async function buildTwoSignerTransaction(version: TransactionVersion) {
  const feePayer = await generateKeyPairSigner();
  const coSigner = await generateKeyPairSigner();
  const program = await generateKeyPairSigner();

  const instruction = {
    programAddress: program.address,
    accounts: [
      {
        address: feePayer.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: feePayer,
      },
      {
        address: coSigner.address,
        role: AccountRole.READONLY_SIGNER,
        signer: coSigner,
      },
    ],
    data: new Uint8Array([1, 2, 3]),
  } as const;

  const message = pipe(
    createTransactionMessage({ version }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash(coSigner.address),
          lastValidBlockHeight: 1000n,
        },
        m,
      ),
    (m) => appendTransactionMessageInstructions([instruction], m),
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const messageBytes = new Uint8Array(signedTx.messageBytes);
  const wireBytes = getTransactionEncoder().encode(signedTx) as Uint8Array;

  return { messageBytes, wireBytes };
}

type MessageParts = {
  /** [numSignerAccounts, numReadonlySignerAccounts, numReadonlyNonSignerAccounts] */
  header?: [number, number, number];
  staticAccounts?: number;
  /** [programAddressIndex, accountIndices] */
  instructions?: [number, number[]][];
  /** v0 only: number of writable and readonly entries of a single lookup table */
  lookup?: { writable: number; readonly: number };
};

/**
 * Hand-assembles a legacy message, or a v0 one when `lookup` is set, that
 * always decodes: only the semantic fields vary. All counts stay below 128,
 * so every compact-u16 is a single byte. The defaults are well formed.
 */
function assembleMessage({
  header = [1, 0, 1],
  staticAccounts = 3,
  instructions = [[2, [0, 1]]],
  lookup,
}: MessageParts = {}): Uint8Array {
  const bytes = [
    ...(lookup ? [0x80] : []),
    ...header,
    staticAccounts,
    ...Array.from({ length: staticAccounts }, (_, i) =>
      new Array<number>(32).fill(0x10 + i),
    ).flat(),
    ...new Array<number>(32).fill(0x33), // blockhash
    instructions.length,
    ...instructions.flatMap(([program, accounts]) => [
      program,
      accounts.length,
      ...accounts,
      1, // data length
      0xaa,
    ]),
  ];
  if (lookup) {
    bytes.push(
      1, // one lookup table
      ...new Array<number>(32).fill(0x55),
      lookup.writable,
      ...Array.from({ length: lookup.writable }, (_, i) => i),
      lookup.readonly,
      ...Array.from({ length: lookup.readonly }, (_, i) => lookup.writable + i),
    );
  }
  return Uint8Array.from(bytes);
}

/** Wraps a message in the legacy/v0 wire format with `count` signatures. */
function withSignatures(count: number, message: Uint8Array): Uint8Array {
  const wire = new Uint8Array(1 + count * 64 + message.length);
  wire[0] = count;
  wire.fill(0x44, 1, 1 + count * 64);
  wire.set(message, 1 + count * 64);
  return wire;
}

describe("TransactionInputNormaliser", () => {
  let normaliser: TransactionInputNormaliser;

  beforeEach(() => {
    normaliser = new TransactionInputNormaliser();
  });

  describe.each(["legacy", 0] as const)(
    "version %s transactions (built with @solana/kit)",
    (version) => {
      it("passes a bare message through unchanged", async () => {
        const { messageBytes } = await buildRandomTransaction(version);

        const result = normaliser.normalize(messageBytes);

        expect(result.messageBytes).toBe(messageBytes);
        expect(result.serializedForTxCheck).toBeUndefined();
      });

      it("extracts message bytes and sets serializedForTxCheck for a signed full-wire transaction", async () => {
        const { messageBytes, wireBytes } =
          await buildRandomTransaction(version);

        const result = normaliser.normalize(wireBytes);

        expect(Array.from(result.messageBytes)).toEqual(
          Array.from(messageBytes),
        );
        expect(result.serializedForTxCheck).toBe(wireBytes);
      });

      it("messageBytes is a subarray of the original wire buffer (no copy)", async () => {
        const { wireBytes } = await buildRandomTransaction(version);

        const result = normaliser.normalize(wireBytes);

        expect(result.messageBytes.buffer).toBe(wireBytes.buffer);
      });

      it("extracts message bytes correctly for a transaction with 2 required signers", async () => {
        const { messageBytes, wireBytes } =
          await buildTwoSignerTransaction(version);

        const result = normaliser.normalize(wireBytes);

        expect(Array.from(result.messageBytes)).toEqual(
          Array.from(messageBytes),
        );
        expect(result.serializedForTxCheck).toBe(wireBytes);
        // the head is the signature count + exactly 2 signatures, not 1.
        expect(wireBytes.length - result.messageBytes.length).toBe(1 + 2 * 64);
      });

      it("handles multiple random instructions with varying account/data sizes", async () => {
        for (let i = 0; i < 5; i++) {
          const { messageBytes, wireBytes } =
            await buildRandomTransaction(version);

          expect(normaliser.normalize(messageBytes).messageBytes).toBe(
            messageBytes,
          );
          const result = normaliser.normalize(wireBytes);
          expect(Array.from(result.messageBytes)).toEqual(
            Array.from(messageBytes),
          );
          expect(result.serializedForTxCheck).toBe(wireBytes);
        }
      });

      it("falls back to raw bytes for a message truncated mid-structure", async () => {
        const { messageBytes } = await buildRandomTransaction(version);
        const truncated = messageBytes.subarray(0, messageBytes.length - 3);

        const result = normaliser.normalize(truncated);

        expect(result.messageBytes).toBe(truncated);
        expect(result.serializedForTxCheck).toBeUndefined();
      });

      it("falls back to raw bytes for input whose length matches neither a bare message nor a full transaction", async () => {
        const { wireBytes } = await buildRandomTransaction(version);
        // trailing bytes after a complete transaction
        const malformed = new Uint8Array(wireBytes.length + 10);
        malformed.set(wireBytes, 0);

        const result = normaliser.normalize(malformed);

        expect(result.messageBytes).toBe(malformed);
        expect(result.serializedForTxCheck).toBeUndefined();
      });
    },
  );

  describe("raw messages a lenient decoder also reads as signed transactions", () => {
    it.each([
      ["unstake", UNSTAKE_MESSAGE],
      ["send with memo", SEND_WITH_MEMO_MESSAGE],
    ])("passes the %s message through unchanged", (_, message) => {
      // Precondition: web3.js reads it as a one-signature transaction.
      expect(() => VersionedTransaction.deserialize(message)).not.toThrow();

      const result = normaliser.normalize(message);

      expect(result.messageBytes).toBe(message);
      expect(result.serializedForTxCheck).toBeUndefined();
    });

    it.each([
      ["unstake", UNSTAKE_MESSAGE],
      ["send with memo", SEND_WITH_MEMO_MESSAGE],
    ])("extracts the %s message from its signed wire format", (_, message) => {
      const wire = withOneSignature(message);

      const result = normaliser.normalize(wire);

      expect(Array.from(result.messageBytes)).toEqual(Array.from(message));
      expect(result.serializedForTxCheck).toBe(wire);
    });
  });

  describe("well-formedness checks", () => {
    // Every message below decodes to its exact length; only one semantic rule
    // differs from the well-formed default. A signed transaction is only
    // recognised when its message is well formed, so a broken rule shows up as
    // a pass-through of the whole input.
    const expectExtracted = (signatures: number, message: Uint8Array) => {
      const wire = withSignatures(signatures, message);
      const result = normaliser.normalize(wire);
      expect(Array.from(result.messageBytes)).toEqual(Array.from(message));
      expect(result.serializedForTxCheck).toBe(wire);
    };
    const expectPassedThrough = (signatures: number, message: Uint8Array) => {
      const wire = withSignatures(signatures, message);
      const result = normaliser.normalize(wire);
      expect(result.messageBytes).toBe(wire);
      expect(result.serializedForTxCheck).toBeUndefined();
    };

    it("extracts a well-formed legacy message", () => {
      expectExtracted(1, assembleMessage());
    });

    it("extracts a well-formed message with 2 signers", () => {
      expectExtracted(2, assembleMessage({ header: [2, 1, 1] }));
    });

    it.each<[string, number, MessageParts]>([
      ["has no signer", 0, { header: [0, 0, 1] }],
      ["has only read-only signers", 1, { header: [1, 1, 1] }],
      [
        "declares more signer and read-only accounts than it has",
        1,
        { header: [1, 0, 3], staticAccounts: 3 },
      ],
      [
        "references a program index past the accounts",
        1,
        { instructions: [[3, [0, 1]]] },
      ],
      [
        "references an account index past the accounts",
        1,
        { instructions: [[2, [0, 3]]] },
      ],
    ])(
      "does not recognise a transaction whose message %s",
      (_, signatures, parts) => {
        expectPassedThrough(signatures, assembleMessage(parts));
      },
    );

    it("does not recognise a transaction whose signature count differs from its signer count", () => {
      const message = assembleMessage();

      expectPassedThrough(2, message);
      expectPassedThrough(0, message);
    });

    it("counts lookup table entries as accounts in a v0 message", () => {
      // 3 static accounts + 2 lookup entries: indexes 0..4 are valid.
      const lookup = { writable: 1, readonly: 1 };

      expectExtracted(
        1,
        assembleMessage({ lookup, instructions: [[2, [0, 4]]] }),
      );
      expectPassedThrough(
        1,
        assembleMessage({ lookup, instructions: [[2, [0, 5]]] }),
      );
    });

    it("recognises a well-formed bare message and nothing else", () => {
      expect(normaliser.detect(assembleMessage())).toEqual({
        messageBytes: assembleMessage(),
      });
      expect(
        normaliser.detect(assembleMessage({ instructions: [[3, [0, 1]]] })),
      ).toBeNull();
    });
  });

  it.each([
    ["v1", withOneSignature(SPEC_V1_MESSAGE)],
    ["unknown-version", withOneSignature(withByte(SPEC_V1_MESSAGE, 0, 0x82))],
  ])(
    "cuts a signature-prefixed %s message out of the input so its version stays visible",
    (_, input) => {
      const result = normaliser.normalize(input);

      expect(result.messageBytes).toEqual(input.subarray(65));
      expect(result.serializedForTxCheck).toBeUndefined();
    },
  );

  it("falls back to raw bytes for garbage input", () => {
    const garbage = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);

    const result = normaliser.normalize(garbage);

    expect(result.messageBytes).toBe(garbage);
    expect(result.serializedForTxCheck).toBeUndefined();
  });

  describe("v1 transactions (SIMD-0385, built with @solana/kit)", () => {
    it("passes a bare v1 message through unchanged", async () => {
      const { messageBytes } = await buildRandomTransaction(1);

      const result = normaliser.normalize(messageBytes);

      expect(result.messageBytes).toBe(messageBytes);
      expect(result.serializedForTxCheck).toBeUndefined();
    });

    it("extracts message bytes and sets serializedForTxCheck for a signed full-wire v1 transaction", async () => {
      const { messageBytes, wireBytes } = await buildRandomTransaction(1);

      const result = normaliser.normalize(wireBytes);

      expect(Array.from(result.messageBytes)).toEqual(Array.from(messageBytes));
      expect(result.serializedForTxCheck).toBe(wireBytes);
    });

    it("messageBytes is a subarray of the original v1 wire buffer (no copy)", async () => {
      const { wireBytes } = await buildRandomTransaction(1);

      const result = normaliser.normalize(wireBytes);

      expect(result.messageBytes.buffer).toBe(wireBytes.buffer);
    });

    it("handles a TransactionConfigMask (priority fee + compute-unit limit) correctly", async () => {
      const { messageBytes, wireBytes } = await buildRandomTransaction(1, {
        withConfig: true,
      });

      const result = normaliser.normalize(wireBytes);

      expect(Array.from(result.messageBytes)).toEqual(Array.from(messageBytes));
      expect(result.serializedForTxCheck).toBe(wireBytes);
    });

    it("extracts message bytes correctly for a v1 transaction with 2 required signers", async () => {
      const { messageBytes, wireBytes } = await buildTwoSignerTransaction(1);
      expect(messageBytes[1]).toBe(2);

      const result = normaliser.normalize(wireBytes);

      expect(Array.from(result.messageBytes)).toEqual(Array.from(messageBytes));
      expect(result.serializedForTxCheck).toBe(wireBytes);
      // the tail is exactly 2 signatures, not 1 — proves the
      // numRequiredSignatures * 64 boundary is computed from the real count.
      expect(wireBytes.length - result.messageBytes.length).toBe(2 * 64);
    });

    it("handles multiple random instructions with varying account/data sizes", async () => {
      // buildRandomTransaction already picks 1-3 random instructions with
      // random account counts and data lengths; run it a few times to
      // exercise a spread of shapes.
      for (let i = 0; i < 5; i++) {
        const { messageBytes, wireBytes } = await buildRandomTransaction(1);

        const result = normaliser.normalize(wireBytes);

        expect(Array.from(result.messageBytes)).toEqual(
          Array.from(messageBytes),
        );
        expect(result.serializedForTxCheck).toBe(wireBytes);
      }
    });

    it("falls back to raw bytes for truncated v1 input shorter than the fixed header", () => {
      const truncated = new Uint8Array([0x81, 1, 0, 0]);

      const result = normaliser.normalize(truncated);

      expect(result.messageBytes).toBe(truncated);
      expect(result.serializedForTxCheck).toBeUndefined();
    });

    it("falls back to raw bytes for a real v1 message truncated mid-structure", async () => {
      const { messageBytes } = await buildRandomTransaction(1);
      const truncated = messageBytes.subarray(0, messageBytes.length - 3);

      const result = normaliser.normalize(truncated);

      expect(result.messageBytes).toBe(truncated);
      expect(result.serializedForTxCheck).toBeUndefined();
    });

    it("falls back to raw bytes for v1 input whose length matches neither a bare message nor a full transaction", async () => {
      const { messageBytes } = await buildRandomTransaction(1);
      // append a partial, incomplete signature (not a full 64-byte block)
      const malformed = new Uint8Array(messageBytes.length + 10);
      malformed.set(messageBytes, 0);

      const result = normaliser.normalize(malformed);

      expect(result.messageBytes).toBe(malformed);
      expect(result.serializedForTxCheck).toBeUndefined();
    });
  });
});
