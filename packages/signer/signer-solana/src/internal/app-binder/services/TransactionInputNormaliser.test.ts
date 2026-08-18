import { VersionedTransaction } from "@solana/web3.js";

import { TransactionInputNormaliser } from "./TransactionInputNormaliser";

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    VersionedTransaction: {
      ...actual.VersionedTransaction,
      deserialize: vi.fn(),
    },
  };
});

const deserializeMock = VersionedTransaction.deserialize as ReturnType<
  typeof vi.fn
>;

const SIGNATURE_LENGTH = 64;

function buildWireFormat(sigCount: number, message: Uint8Array): Uint8Array {
  // compact-u16 for values < 128 is a single byte
  const wire = new Uint8Array(1 + sigCount * SIGNATURE_LENGTH + message.length);
  wire[0] = sigCount;
  wire.set(message, 1 + sigCount * SIGNATURE_LENGTH);
  return wire;
}

describe("TransactionInputNormaliser", () => {
  let normaliser: TransactionInputNormaliser;

  beforeEach(() => {
    vi.resetAllMocks();
    normaliser = new TransactionInputNormaliser();
  });

  it("passes raw message bytes through unchanged when deserialize throws", () => {
    deserializeMock.mockImplementation(() => {
      throw new Error("not a valid wire-format transaction");
    });

    const message = new Uint8Array([1, 0, 3, 0xf0, 0xca, 0xcc, 0x1a]);
    const result = normaliser.normalize(message);

    expect(result.messageBytes).toBe(message);
    expect(result.serializedForTxCheck).toBeUndefined();
  });

  it("extracts message bytes and sets serializedForTxCheck when deserialize succeeds (1 signer)", () => {
    deserializeMock.mockReturnValue({});

    const message = new Uint8Array([1, 0, 3, 0xf0, 0xca, 0xcc, 0x1a]);
    const wire = buildWireFormat(1, message);
    const result = normaliser.normalize(wire);

    expect(Array.from(result.messageBytes)).toEqual(Array.from(message));
    expect(result.serializedForTxCheck).toBe(wire);
  });

  it("extracts message bytes correctly for a 2-signer transaction", () => {
    deserializeMock.mockReturnValue({});

    const message = new Uint8Array([2, 0, 3, 0xf0, 0xca, 0xcc, 0x1a]);
    const wire = buildWireFormat(2, message);
    const result = normaliser.normalize(wire);

    expect(Array.from(result.messageBytes)).toEqual(Array.from(message));
    expect(result.serializedForTxCheck).toBe(wire);
  });

  it("messageBytes is a subarray of the original wire buffer (no copy)", () => {
    deserializeMock.mockReturnValue({});

    const message = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);
    const wire = buildWireFormat(1, message);
    const result = normaliser.normalize(wire);

    // subarray shares the same underlying ArrayBuffer
    expect(result.messageBytes.buffer).toBe(wire.buffer);
  });

  it("falls back to raw bytes when deserialize throws on garbage input", () => {
    deserializeMock.mockImplementation(() => {
      throw new Error("malformed");
    });

    const garbage = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);
    const result = normaliser.normalize(garbage);

    expect(result.messageBytes).toBe(garbage);
    expect(result.serializedForTxCheck).toBeUndefined();
  });
});
