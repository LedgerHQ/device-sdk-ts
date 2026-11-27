import {
  type Blockhash,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

vi.mock("@ledgerhq/device-management-kit", () => ({
  base64StringToBuffer: (value: string): Uint8Array | null => {
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
    return fromBase64(value);
  },
}));

import { buildV1MessageBytes } from "./__test-utils__/v1Message";
import { deserializeToMessage, isFullTransaction } from "./deserialize";

// v1 (SIMD-0385) input belongs to the V1 crafter; the web3.js path refuses it.
const v1Message = buildV1MessageBytes();
// A v1 transaction is message-first: the message, then one signature.
const v1Transaction = new Uint8Array([...v1Message, ...new Uint8Array(64)]);
const NEITHER =
  "Input is neither a valid serialized message nor a valid serialized transaction.";

const payer = new PublicKey("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const recipient = new PublicKey("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");
const recentBlockhash =
  "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg" as Blockhash;

function transferInstruction() {
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: recipient,
    lamports: 1_000_000,
  });
}

function buildLegacyMessageBytes(): Uint8Array {
  const tx = new Transaction({ recentBlockhash, feePayer: payer });
  tx.add(transferInstruction());
  return new Uint8Array(tx.serializeMessage());
}

function buildLegacyTransactionBytes(): Uint8Array {
  const tx = new Transaction({ recentBlockhash, feePayer: payer });
  tx.add(transferInstruction());
  // Signed wire format with a zero-filled signature.
  return new VersionedTransaction(tx.compileMessage()).serialize();
}

function buildV0MessageBytes(): Uint8Array {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash,
    instructions: [transferInstruction()],
  }).compileToV0Message();
  return message.serialize();
}

function buildV0TransactionBytes(): Uint8Array {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash,
    instructions: [transferInstruction()],
  }).compileToV0Message();
  return new VersionedTransaction(message).serialize();
}

describe("deserializeToMessage", () => {
  it("deserializes a legacy message and round-trips it byte-for-byte", () => {
    const bytes = buildLegacyMessageBytes();

    const message = deserializeToMessage(toBase64(bytes));

    expect(message.version).toBe("legacy");
    expect(new Uint8Array(message.serialize())).toEqual(bytes);
  });

  it("deserializes a v0 message and round-trips it byte-for-byte", () => {
    const bytes = buildV0MessageBytes();

    const message = deserializeToMessage(toBase64(bytes));

    expect(message.version).toBe(0);
    expect(new Uint8Array(message.serialize())).toEqual(bytes);
  });

  it("returns the inner message of a full legacy transaction, dropping signatures", () => {
    const txBytes = buildLegacyTransactionBytes();
    const messageBytes = buildLegacyMessageBytes();

    const message = deserializeToMessage(toBase64(txBytes));

    expect(message.version).toBe("legacy");
    expect(new Uint8Array(message.serialize())).toEqual(messageBytes);
    expect(message.serialize().length).toBeLessThan(txBytes.length);
  });

  it("returns the inner message of a full v0 transaction, dropping signatures", () => {
    const txBytes = buildV0TransactionBytes();
    const messageBytes = buildV0MessageBytes();

    const message = deserializeToMessage(toBase64(txBytes));

    expect(message.version).toBe(0);
    expect(new Uint8Array(message.serialize())).toEqual(messageBytes);
    expect(message.serialize().length).toBeLessThan(txBytes.length);
  });

  it("throws on input that is not valid base64", () => {
    expect(() => deserializeToMessage("!!!not base64!!!")).toThrow(
      "Input is not a valid base64 string.",
    );
  });

  it("refuses a v1 message", () => {
    expect(() => deserializeToMessage(toBase64(v1Message))).toThrow(NEITHER);
  });

  it("refuses a v1 transaction", () => {
    expect(() => deserializeToMessage(toBase64(v1Transaction))).toThrow(
      NEITHER,
    );
  });

  it("throws on base64 that is neither a message nor a transaction", () => {
    const garbage = toBase64(new Uint8Array([0xff, 0xff, 0xff, 0xff]));

    expect(() => deserializeToMessage(garbage)).toThrow(
      "Input is neither a valid serialized message nor a valid serialized transaction.",
    );
  });
});

describe("isFullTransaction", () => {
  it("is false for a bare legacy message", () => {
    expect(isFullTransaction(toBase64(buildLegacyMessageBytes()))).toBe(false);
  });

  it("is false for a bare v0 message", () => {
    expect(isFullTransaction(toBase64(buildV0MessageBytes()))).toBe(false);
  });

  it("is true for a full legacy transaction", () => {
    expect(isFullTransaction(toBase64(buildLegacyTransactionBytes()))).toBe(
      true,
    );
  });

  it("is true for a full v0 transaction", () => {
    expect(isFullTransaction(toBase64(buildV0TransactionBytes()))).toBe(true);
  });

  it("does not report a v1 transaction as a full transaction", () => {
    expect(isFullTransaction(toBase64(v1Transaction))).toBe(false);
  });

  it("is false for invalid base64", () => {
    expect(isFullTransaction("!!!not base64!!!")).toBe(false);
  });

  it("is false for garbage binary input", () => {
    const garbage = toBase64(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    expect(isFullTransaction(garbage)).toBe(false);
  });
});
