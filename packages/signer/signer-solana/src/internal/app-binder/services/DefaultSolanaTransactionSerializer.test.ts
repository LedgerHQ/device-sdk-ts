import { DefaultSolanaTransactionSerializer } from "./DefaultSolanaTransactionSerializer";

const SIG_LEN = 64;

let serializer: DefaultSolanaTransactionSerializer;

beforeEach(() => {
  serializer = new DefaultSolanaTransactionSerializer();
});

function buildSerializedTx(
  message: Uint8Array,
  slots: Array<Uint8Array | null>,
): Uint8Array {
  const count = slots.length;
  const tx = new Uint8Array(1 + count * SIG_LEN + message.length);
  tx[0] = count;
  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    if (slot) tx.set(slot, 1 + i * SIG_LEN);
  }
  tx.set(message, 1 + count * SIG_LEN);
  return tx;
}

function buildRealSignature(fill: number): Uint8Array {
  const sig = new Uint8Array(SIG_LEN);
  sig[0] = fill;
  sig[1] = fill + 1;
  return sig;
}

describe("DefaultSolanaTransactionSerializer", () => {
  describe("wrapMessageAsTransaction — zero-fill", () => {
    it("wraps a legacy message with zero-filled signature placeholders", () => {
      const message = new Uint8Array([2, 0, 3, 0xaa, 0xbb, 0xcc]);
      const expected = new Uint8Array(1 + 2 * SIG_LEN + message.length);
      expected[0] = 2;
      expected.set(message, 1 + 2 * SIG_LEN);

      expect(Array.from(serializer.wrapMessageAsTransaction(message))).toEqual(
        Array.from(expected),
      );
    });

    it("wraps a versioned (v0) message with signature placeholders", () => {
      const message = new Uint8Array([0x80, 1, 0, 3, 0xde, 0xad]);
      const expected = new Uint8Array(1 + SIG_LEN + message.length);
      expected[0] = 1;
      expected.set(message, 1 + SIG_LEN);

      expect(Array.from(serializer.wrapMessageAsTransaction(message))).toEqual(
        Array.from(expected),
      );
    });

    it("throws when numRequiredSignatures exceeds SOLANA_MAX_SIGNATURES", () => {
      const message = new Uint8Array([65, 0, 3, 0xaa]);
      expect(() => serializer.wrapMessageAsTransaction(message)).toThrow(
        "exceeds SOLANA_MAX_SIGNATURES",
      );
    });

    it("throws when message is empty", () => {
      expect(() =>
        serializer.wrapMessageAsTransaction(new Uint8Array()),
      ).toThrow();
    });
  });

  describe("wrapMessageAsTransaction — co-signer signature recovery", () => {
    it("absent field → payload identical to legacy zero-fill", () => {
      const message = new Uint8Array([2, 0, 3, 0xaa, 0xbb]);
      const expected = new Uint8Array(1 + 2 * SIG_LEN + message.length);
      expected[0] = 2;
      expected.set(message, 1 + 2 * SIG_LEN);

      expect(Array.from(serializer.wrapMessageAsTransaction(message))).toEqual(
        Array.from(expected),
      );
    });

    it("two-signer: real signature in slot 1 appears at the correct offset, slot 0 stays zero", () => {
      const message = new Uint8Array([2, 0, 3, 0xaa, 0xbb, 0xcc]);
      const realSig = buildRealSignature(0x42);
      const serializedTx = buildSerializedTx(message, [null, realSig]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const slot0 = payload.slice(1, 1 + SIG_LEN);
      const slot1 = payload.slice(1 + SIG_LEN, 1 + 2 * SIG_LEN);
      expect(slot0.every((b) => b === 0)).toBe(true);
      expect(Array.from(slot1)).toEqual(Array.from(realSig));
    });

    it("0x01-filled placeholder in slot 0 is normalized to zero", () => {
      const message = new Uint8Array([1, 0, 3, 0xaa]);
      const dummySig = new Uint8Array(SIG_LEN).fill(0x01);
      const serializedTx = buildSerializedTx(message, [dummySig]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const slot0 = payload.slice(1, 1 + SIG_LEN);
      expect(slot0.every((b) => b === 0)).toBe(true);
    });

    it("all-zero slot is kept as zero (not forwarded as a signature)", () => {
      const message = new Uint8Array([1, 0, 3, 0xaa]);
      const zeroSig = new Uint8Array(SIG_LEN);
      const serializedTx = buildSerializedTx(message, [zeroSig]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const slot0 = payload.slice(1, 1 + SIG_LEN);
      expect(slot0.every((b) => b === 0)).toBe(true);
    });

    it("versioned (v0) message with a real signature lands at the correct offset", () => {
      const message = new Uint8Array([0x80, 1, 0, 3, 0xde, 0xad]);
      const realSig = buildRealSignature(0x99);
      const serializedTx = buildSerializedTx(message, [realSig]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const slot0 = payload.slice(1, 1 + SIG_LEN);
      expect(Array.from(slot0)).toEqual(Array.from(realSig));
    });

    it("falls back to zero-fill when signature count disagrees with message header", () => {
      const message = new Uint8Array([2, 0, 3, 0xaa]);
      const serializedTx = buildSerializedTx(message, [null]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const sigBytes = payload.slice(1, 1 + 2 * SIG_LEN);
      expect(sigBytes.every((b) => b === 0)).toBe(true);
    });

    it("falls back to zero-fill when message region length mismatches", () => {
      const message = new Uint8Array([1, 0, 3, 0xaa]);
      const wrongMessage = new Uint8Array([1, 0, 3, 0xaa, 0xff]);
      const serializedTx = buildSerializedTx(wrongMessage, [null]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const sigBytes = payload.slice(1, 1 + SIG_LEN);
      expect(sigBytes.every((b) => b === 0)).toBe(true);
    });

    it("falls back to zero-fill when message region content mismatches (stale blockhash case)", () => {
      const message = new Uint8Array([1, 0, 3, 0xaa]);
      const differentMessage = new Uint8Array([1, 0, 3, 0xbb]);
      const serializedTx = buildSerializedTx(differentMessage, [null]);

      const payload = serializer.wrapMessageAsTransaction(
        message,
        serializedTx,
      );
      const sigBytes = payload.slice(1, 1 + SIG_LEN);
      expect(sigBytes.every((b) => b === 0)).toBe(true);
    });

    it("falls back to zero-fill when the blob is truncated", () => {
      const message = new Uint8Array([1, 0, 3, 0xaa]);
      const truncated = new Uint8Array([1, ...new Array(32).fill(0)]);

      const payload = serializer.wrapMessageAsTransaction(message, truncated);
      const sigBytes = payload.slice(1, 1 + SIG_LEN);
      expect(sigBytes.every((b) => b === 0)).toBe(true);
    });

    it("falls back to zero-fill and does not throw when the compact-u16 header is unterminated", () => {
      const message = new Uint8Array([1, 0, 3, 0xaa]);
      const unterminated = new Uint8Array([0x80, 0x80, 0x80, 0x80]);

      expect(() =>
        serializer.wrapMessageAsTransaction(message, unterminated),
      ).not.toThrow();

      const payload = serializer.wrapMessageAsTransaction(
        message,
        unterminated,
      );
      const sigBytes = payload.slice(1, 1 + SIG_LEN);
      expect(sigBytes.every((b) => b === 0)).toBe(true);
    });
  });
});
