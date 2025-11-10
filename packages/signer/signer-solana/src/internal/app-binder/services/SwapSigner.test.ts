import {
  Keypair,
  Message,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { SwapSigner } from "./SwapSigner";

const RECENT_BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function locatePayerOffsetLegacyMessage(
  buffer: Uint8Array,
  messageOffset = 0,
): number {
  let cursor = messageOffset;

  if (cursor + 3 > buffer.length) throw new Error("bad legacy header");

  const requiredSignatures = buffer[cursor];
  if (requiredSignatures && requiredSignatures < 1)
    throw new Error("no required signatures");
  cursor += 3; // header: numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned

  const { length: accountCount, size: accountCountSize } =
    new SwapSigner().decodeShortVec(buffer, cursor);
  cursor += accountCountSize;

  if (accountCount < 1) throw new Error("no accounts");

  const accountKeysStart = cursor;
  const accountKeysBytes = accountCount * 32;

  // +32 for recent blockhash presence check
  if (accountKeysStart + accountKeysBytes + 32 > buffer.length) {
    throw new Error("out of bounds");
  }

  return accountKeysStart; // payer = first key
}

function locatePayerOffsetV0Message(
  buffer: Uint8Array,
  messageOffset = 0,
): number {
  let cursor = messageOffset;

  const versionByte = buffer[cursor];
  if (versionByte === undefined || (versionByte & 0x80) === 0) {
    throw new Error("not v0");
  }
  cursor += 1; // version byte

  if (cursor + 3 > buffer.length) throw new Error("bad v0 header");

  const requiredSignatures = buffer[cursor];
  if (requiredSignatures && requiredSignatures < 1)
    throw new Error("no required signatures");
  cursor += 3; // header

  const { length: accountCount, size: accountCountSize } =
    new SwapSigner().decodeShortVec(buffer, cursor);
  cursor += accountCountSize;

  if (accountCount < 1) throw new Error("no accounts");

  const accountKeysStart = cursor;
  const accountKeysBytes = accountCount * 32;

  if (accountKeysStart + accountKeysBytes + 32 > buffer.length) {
    throw new Error("out of bounds");
  }

  return accountKeysStart; // payer = first key
}

/** some web3.js versions serialize v0 messages without the version byte,
 * handles both encodings so tests are stable across environments */
function locatePayerOffsetMessageAuto(
  buffer: Uint8Array,
  messageOffset = 0,
): number {
  const versionByte = buffer[messageOffset];
  if (versionByte !== undefined && (versionByte & 0x80) !== 0) {
    try {
      return locatePayerOffsetV0Message(buffer, messageOffset);
    } catch {
      // fall through to legacy parsing if message lacks explicit version byte
    }
  }
  return locatePayerOffsetLegacyMessage(buffer, messageOffset);
}

function expectAllZero(bytes: Uint8Array, start: number, end: number) {
  for (let i = start; i < end; i++) expect(bytes[i]).toBe(0);
}

describe("SwapSigner", () => {
  const payer = Keypair.generate();
  const recipient = Keypair.generate();
  const newPayer = Keypair.generate();

  it("swaps payer in a legacy MESSAGE (keeps structure and instructions)", () => {
    // given
    const ix = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1234,
    });

    const tx = new Transaction({
      recentBlockhash: RECENT_BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(ix);
    const msgB64 = Buffer.from(tx.serializeMessage()).toString("base64");

    // when
    const outB64 = new SwapSigner().swap(msgB64, newPayer.publicKey.toBase58());

    // then
    const outBytes = base64ToBytes(outB64);
    const msg = Message.from(outBytes);
    expect(msg.accountKeys[0]!.equals(newPayer.publicKey)).toBe(true);
    // instructions preserved
    expect(msg.instructions).toHaveLength(1);
    const pid = msg.accountKeys[msg.instructions[0]!.programIdIndex]!;
    expect(pid.equals(SystemProgram.programId)).toBe(true);
  });

  it("swaps payer and ZEROES SIGNATURES in a legacy TRANSACTION", () => {
    // given
    const ix = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 5678,
    });

    const tx = new Transaction({
      recentBlockhash: RECENT_BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(ix);
    tx.sign(payer);
    const txB64 = Buffer.from(tx.serialize()).toString("base64");

    // when
    const outB64 = new SwapSigner().swap(txB64, newPayer.publicKey.toBase58());

    // then
    const outBytes = base64ToBytes(outB64);

    // decode signatures section
    let c = 0;
    const { length: sigCount, size: sigLen } = new SwapSigner().decodeShortVec(
      outBytes,
      c,
    );
    c += sigLen;
    expect(sigCount).toBeGreaterThan(0);

    // all signatures are zero
    for (let i = 0; i < sigCount; i++) {
      const start = c + i * 64;
      const end = start + 64;
      expectAllZero(outBytes, start, end);
    }

    // message starts after signatures
    const msgOffset = c + sigCount * 64;
    const payerOffset = locatePayerOffsetLegacyMessage(outBytes, msgOffset);
    const payerBytes = outBytes.slice(payerOffset, payerOffset + 32);
    expect(new PublicKey(payerBytes).equals(newPayer.publicKey)).toBe(true);
  });

  it("swaps payer in a v0 MESSAGE", () => {
    // given
    const ix = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 42,
    });

    const v0msg = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: RECENT_BLOCKHASH,
      instructions: [ix],
    }).compileToV0Message();

    const msgB64 = Buffer.from(v0msg.serialize()).toString("base64");

    // when
    const outB64 = new SwapSigner().swap(msgB64, newPayer.publicKey.toBase58());

    // then
    const outBytes = base64ToBytes(outB64);
    const payerOffset = locatePayerOffsetMessageAuto(outBytes, 0);
    const payerBytes = outBytes.slice(payerOffset, payerOffset + 32);
    expect(new PublicKey(payerBytes).equals(newPayer.publicKey)).toBe(true);
  });

  it("swaps payer and ZEROES SIGNATURES in a v0 TRANSACTION", () => {
    // given
    const ix = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 99,
    });

    const v0msg = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: RECENT_BLOCKHASH,
      instructions: [ix],
    }).compileToV0Message();

    const vtx = new VersionedTransaction(v0msg);
    vtx.sign([payer]);

    const txB64 = Buffer.from(vtx.serialize()).toString("base64");

    // when
    const outB64 = new SwapSigner().swap(txB64, newPayer.publicKey.toBase58());

    // then
    const outBytes = base64ToBytes(outB64);

    // signatures section
    let c = 0;
    const { length: sigCount, size: sigLen } = new SwapSigner().decodeShortVec(
      outBytes,
      c,
    );
    c += sigLen;
    expect(sigCount).toBeGreaterThan(0);

    for (let i = 0; i < sigCount; i++) {
      const start = c + i * 64;
      const end = start + 64;
      expectAllZero(outBytes, start, end);
    }

    const msgOffset = c + sigCount * 64;
    const payerOffset = locatePayerOffsetMessageAuto(outBytes, msgOffset);
    const payerBytes = outBytes.slice(payerOffset, payerOffset + 32);
    expect(new PublicKey(payerBytes).equals(newPayer.publicKey)).toBe(true);
  });
});
