import {
  Keypair,
  Message,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

import { TransactionCrafterService } from "./TransactionCrafterService";

const RECENT_BLOCKHASH = "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg";

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
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
    new TransactionCrafterService().decodeShortVec(buffer, cursor);
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
    new TransactionCrafterService().decodeShortVec(buffer, cursor);
  cursor += accountCountSize;

  if (accountCount < 1) throw new Error("no accounts");

  const accountKeysStart = cursor;
  const accountKeysBytes = accountCount * 32;

  if (accountKeysStart + accountKeysBytes + 32 > buffer.length) {
    throw new Error("out of bounds");
  }

  return accountKeysStart; // payer = first key
}

// some web3.js versions serialise v0 messages without the version byte, handles both encodings so tests are stable across environments
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

// Helper to parse a message (legacy or v0) and return accounts + recent blockhash. Uses the same layout assumptions as TransactionCrafterServiceInstance.locatePayerInMessage
function parseMessageAccountsAndBlockhash(
  buffer: Uint8Array,
  messageOffset = 0,
  opts: { versioned: boolean },
) {
  const TransactionCrafterServiceInstance = new TransactionCrafterService();
  let cursor = messageOffset;

  if (opts.versioned) {
    const versionByte = buffer[cursor];
    if (versionByte === undefined || (versionByte & 0x80) === 0) {
      throw new Error("not versioned");
    }
    const version = versionByte & 0x7f;
    if (version !== 0) throw new Error("unsupported version");
    cursor += 1;
  }

  if (cursor + 3 > buffer.length) {
    throw new Error("bad header");
  }

  const numRequiredSignatures = buffer[cursor];
  const numReadonlySigned = buffer[cursor + 1];
  const numReadonlyUnsigned = buffer[cursor + 2];
  cursor += 3;

  const { length: accountCount, size: accountCountSize } =
    TransactionCrafterServiceInstance.decodeShortVec(buffer, cursor);
  cursor += accountCountSize;

  const accountKeysStart = cursor;
  const accountKeysBytes = accountCount * 32;
  const recentBlockhashStart = accountKeysStart + accountKeysBytes;
  const recentBlockhashEnd = recentBlockhashStart + 32;

  if (recentBlockhashEnd > buffer.length) {
    throw new Error("out of bounds");
  }

  const accounts: Uint8Array[] = [];
  for (let i = 0; i < accountCount; i++) {
    const start = accountKeysStart + i * 32;
    accounts.push(buffer.slice(start, start + 32));
  }
  const recentBlockhash = buffer.slice(
    recentBlockhashStart,
    recentBlockhashEnd,
  );

  return {
    numRequiredSignatures,
    numReadonlySigned,
    numReadonlyUnsigned,
    accounts,
    recentBlockhash,
  };
}

// auto-detect v0 vs legacy based on high bit, like locatePayerOffsetMessageAuto
function parseMessageAccountsAndBlockhashAuto(
  buffer: Uint8Array,
  messageOffset = 0,
) {
  const versionByte = buffer[messageOffset];
  if (versionByte !== undefined && (versionByte & 0x80) !== 0) {
    try {
      return parseMessageAccountsAndBlockhash(buffer, messageOffset, {
        versioned: true,
      });
    } catch {
      // fall through to legacy-style parse if no explicit version byte
    }
  }
  return parseMessageAccountsAndBlockhash(buffer, messageOffset, {
    versioned: false,
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function buildLegacyMessageBase64(): string {
  const payer = Keypair.generate();
  const recipient = Keypair.generate();

  const instructions = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: recipient.publicKey,
    lamports: 1,
  });

  const transaction = new Transaction({
    recentBlockhash: RECENT_BLOCKHASH,
    feePayer: payer.publicKey,
  }).add(instructions);

  return Buffer.from(transaction.serializeMessage()).toString("base64");
}

describe("TransactionCrafterServiceInstance", () => {
  const payer = Keypair.generate();
  const recipient = Keypair.generate();
  const newPayer = Keypair.generate();

  it("replaces payer in a legacy message (keeps structure and instructions)", () => {
    // given
    const instructions = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 1234,
    });

    const transaction = new Transaction({
      recentBlockhash: RECENT_BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(instructions);
    const msgB64 = Buffer.from(transaction.serializeMessage()).toString(
      "base64",
    );

    // when
    const outputB64 = new TransactionCrafterService().getCraftedTransaction(
      msgB64,
      newPayer.publicKey.toBase58(),
    );

    // then
    const outputBytes = base64ToBytes(outputB64);
    const msg = Message.from(outputBytes);
    expect(msg.accountKeys[0]!.equals(newPayer.publicKey)).toBe(true);
    // instructions preserved
    expect(msg.instructions).toHaveLength(1);
    const pid = msg.accountKeys[msg.instructions[0]!.programIdIndex]!;
    expect(pid.equals(SystemProgram.programId)).toBe(true);
  });

  it("replaces payer and zeroes signatures in a legacy transaction", () => {
    // given
    const instructions = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 5678,
    });

    const transaction = new Transaction({
      recentBlockhash: RECENT_BLOCKHASH,
      feePayer: payer.publicKey,
    }).add(instructions);
    transaction.sign(payer);
    const transactionB64 = Buffer.from(transaction.serialize()).toString(
      "base64",
    );

    // when
    const outputB64 = new TransactionCrafterService().getCraftedTransaction(
      transactionB64,
      newPayer.publicKey.toBase58(),
    );

    // then
    const outputBytes = base64ToBytes(outputB64);

    // decode signatures section
    let cursor = 0;
    const { length: signatureCount, size: sigLen } =
      new TransactionCrafterService().decodeShortVec(outputBytes, cursor);
    cursor += sigLen;
    expect(signatureCount).toBeGreaterThan(0);

    // all signatures are zero
    for (let i = 0; i < signatureCount; i++) {
      const start = cursor + i * 64;
      const end = start + 64;
      expectAllZero(outputBytes, start, end);
    }

    // message starts after signatures
    const msgOffset = cursor + signatureCount * 64;
    const payerOffset = locatePayerOffsetLegacyMessage(outputBytes, msgOffset);
    const payerBytes = outputBytes.slice(payerOffset, payerOffset + 32);
    expect(new PublicKey(payerBytes).equals(newPayer.publicKey)).toBe(true);
  });

  it("replaces payer in a v0 message", () => {
    // given
    const instructions = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 42,
    });

    const v0msg = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: RECENT_BLOCKHASH,
      instructions: [instructions],
    }).compileToV0Message();

    const msgB64 = Buffer.from(v0msg.serialize()).toString("base64");

    // when
    const outputB64 = new TransactionCrafterService().getCraftedTransaction(
      msgB64,
      newPayer.publicKey.toBase58(),
    );

    // then
    const outputBytes = base64ToBytes(outputB64);
    const payerOffset = locatePayerOffsetMessageAuto(outputBytes, 0);
    const payerBytes = outputBytes.slice(payerOffset, payerOffset + 32);
    expect(new PublicKey(payerBytes).equals(newPayer.publicKey)).toBe(true);
  });

  it("replaces payer and zeroes signatures in a v0 transaction", () => {
    // given
    const instructions = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 99,
    });

    const v0msg = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: RECENT_BLOCKHASH,
      instructions: [instructions],
    }).compileToV0Message();

    const versionedTransaction = new VersionedTransaction(v0msg);
    versionedTransaction.sign([payer]);

    const transactionB64 = Buffer.from(
      versionedTransaction.serialize(),
    ).toString("base64");

    // when
    const outputB64 = new TransactionCrafterService().getCraftedTransaction(
      transactionB64,
      newPayer.publicKey.toBase58(),
    );

    // then
    const outputBytes = base64ToBytes(outputB64);

    // signatures section
    let cursor = 0;
    const { length: signatureCount, size: sigLen } =
      new TransactionCrafterService().decodeShortVec(outputBytes, cursor);
    cursor += sigLen;
    expect(signatureCount).toBeGreaterThan(0);

    for (let i = 0; i < signatureCount; i++) {
      const start = cursor + i * 64;
      const end = start + 64;
      expectAllZero(outputBytes, start, end);
    }

    const msgOffset = cursor + signatureCount * 64;
    const payerOffset = locatePayerOffsetMessageAuto(outputBytes, msgOffset);
    const payerBytes = outputBytes.slice(payerOffset, payerOffset + 32);
    expect(new PublicKey(payerBytes).equals(newPayer.publicKey)).toBe(true);
  });

  describe("valid messages preserve non-payer accounts and blockhash", () => {
    it("legacy message: only payer changes, other accounts + blockhash stay the same", () => {
      // given
      const instructions = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 111,
      });

      const transaction = new Transaction({
        recentBlockhash: RECENT_BLOCKHASH,
        feePayer: payer.publicKey,
      }).add(instructions);
      const originalMsgBytes = transaction.serializeMessage();
      const originalLayout = parseMessageAccountsAndBlockhash(
        originalMsgBytes,
        0,
        { versioned: false },
      );

      const msgB64 = bytesToBase64(originalMsgBytes);

      // when
      const outputB64 = new TransactionCrafterService().getCraftedTransaction(
        msgB64,
        newPayer.publicKey.toBase58(),
      );

      // then
      const outputBytes = base64ToBytes(outputB64);
      const craftedLayout = parseMessageAccountsAndBlockhash(outputBytes, 0, {
        versioned: false,
      });

      // account count preserved
      expect(craftedLayout.accounts.length).toBe(
        originalLayout.accounts.length,
      );

      // payer changed
      expect(
        new PublicKey(craftedLayout.accounts[0]!).equals(newPayer.publicKey),
      ).toBe(true);

      // non-payer accounts unchanged
      for (let i = 1; i < originalLayout.accounts.length; i++) {
        expect(bytesToHex(craftedLayout.accounts[i]!)).toBe(
          bytesToHex(originalLayout.accounts[i]!),
        );
      }

      // blockhash unchanged
      expect(bytesToHex(craftedLayout.recentBlockhash)).toBe(
        bytesToHex(originalLayout.recentBlockhash),
      );
    });

    it("v0 message: only payer changes, other accounts + blockhash stay the same", () => {
      // given
      const instructions = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 222,
      });

      const v0msg = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: RECENT_BLOCKHASH,
        instructions: [instructions],
      }).compileToV0Message();

      const originalBytes = v0msg.serialize();
      const originalLayout = parseMessageAccountsAndBlockhashAuto(
        originalBytes,
        0,
      );
      const msgB64 = bytesToBase64(originalBytes);

      // when
      const outputB64 = new TransactionCrafterService().getCraftedTransaction(
        msgB64,
        newPayer.publicKey.toBase58(),
      );

      // then
      const outputBytes = base64ToBytes(outputB64);
      const craftedLayout = parseMessageAccountsAndBlockhashAuto(
        outputBytes,
        0,
      );

      expect(craftedLayout.accounts.length).toBe(
        originalLayout.accounts.length,
      );

      // payer changed
      expect(
        new PublicKey(craftedLayout.accounts[0]!).equals(newPayer.publicKey),
      ).toBe(true);

      // non-payer accounts unchanged
      for (let i = 1; i < originalLayout.accounts.length; i++) {
        expect(bytesToHex(craftedLayout.accounts[i]!)).toBe(
          bytesToHex(originalLayout.accounts[i]!),
        );
      }

      // blockhash unchanged
      expect(bytesToHex(craftedLayout.recentBlockhash)).toBe(
        bytesToHex(originalLayout.recentBlockhash),
      );
    });
  });

  describe("valid transactions preserve signature count and message layout", () => {
    it("legacy transaction: payer replaced, signatures zeroed, length and sig count preserved", () => {
      // given
      const instructions = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 333,
      });

      const transaction = new Transaction({
        recentBlockhash: RECENT_BLOCKHASH,
        feePayer: payer.publicKey,
      }).add(instructions);
      transaction.sign(payer);

      const originalBytes = transaction.serialize();
      const transactionB64 = bytesToBase64(originalBytes);

      // when
      const outputB64 = new TransactionCrafterService().getCraftedTransaction(
        transactionB64,
        newPayer.publicKey.toBase58(),
      );

      // then
      const outputBytes = base64ToBytes(outputB64);

      // overall length preserved
      expect(outputBytes.length).toBe(originalBytes.length);

      // signature section layout preserved
      const countBefore = 0;
      const { length: signatureCountBefore, size: signatureLengthBefore } =
        new TransactionCrafterService().decodeShortVec(
          originalBytes,
          countBefore,
        );
      const signatureSectionStartBefore = countBefore + signatureLengthBefore;
      const signatureSectionEndBefore =
        signatureSectionStartBefore + signatureCountBefore * 64;
      const msgOffsetBefore = signatureSectionEndBefore;

      const countAfter = 0;
      const { length: signatureCountAfter, size: signatureLengthAfter } =
        new TransactionCrafterService().decodeShortVec(outputBytes, countAfter);
      const signatureSectionStartAfter = countAfter + signatureLengthAfter;
      const signatureSectionEndAfter =
        signatureSectionStartAfter + signatureCountAfter * 64;
      const msgOffsetAfter = signatureSectionEndAfter;

      expect(signatureCountAfter).toBe(signatureCountBefore);
      expect(signatureLengthAfter).toBe(signatureLengthBefore);

      // all signature bytes zeroed
      expectAllZero(
        outputBytes,
        signatureSectionStartAfter,
        signatureSectionEndAfter,
      );

      // message contents: only payer changes
      const originalLayout = parseMessageAccountsAndBlockhash(
        originalBytes,
        msgOffsetBefore,
        { versioned: false },
      );
      const craftedLayout = parseMessageAccountsAndBlockhash(
        outputBytes,
        msgOffsetAfter,
        { versioned: false },
      );

      expect(craftedLayout.accounts.length).toBe(
        originalLayout.accounts.length,
      );

      // payer changed
      expect(
        new PublicKey(craftedLayout.accounts[0]!).equals(newPayer.publicKey),
      ).toBe(true);

      // non-payer accounts unchanged
      for (let i = 1; i < originalLayout.accounts.length; i++) {
        expect(bytesToHex(craftedLayout.accounts[i]!)).toBe(
          bytesToHex(originalLayout.accounts[i]!),
        );
      }

      // blockhash unchanged
      expect(bytesToHex(craftedLayout.recentBlockhash)).toBe(
        bytesToHex(originalLayout.recentBlockhash),
      );
    });

    it("v0 transaction: payer replaced, signatures zeroed, length and sig count preserved", () => {
      // given
      const instructions = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 444,
      });

      const v0msg = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: RECENT_BLOCKHASH,
        instructions: [instructions],
      }).compileToV0Message();

      const versionedTransaction = new VersionedTransaction(v0msg);
      versionedTransaction.sign([payer]);

      const originalBytes = versionedTransaction.serialize();
      const transactionB64 = bytesToBase64(originalBytes);

      // when
      const outputB64 = new TransactionCrafterService().getCraftedTransaction(
        transactionB64,
        newPayer.publicKey.toBase58(),
      );

      // then
      const outputBytes = base64ToBytes(outputB64);

      expect(outputBytes.length).toBe(originalBytes.length);

      const cBefore = 0;
      const { length: signatureCountBefore, size: signatureLengthBefore } =
        new TransactionCrafterService().decodeShortVec(originalBytes, cBefore);
      const signatureSectionStartBefore = cBefore + signatureLengthBefore;
      const signatureSectionEndBefore =
        signatureSectionStartBefore + signatureCountBefore * 64;
      const msgOffsetBefore = signatureSectionEndBefore;

      const countAfter = 0;
      const { length: signatureCountAfter, size: signatureLengthAfter } =
        new TransactionCrafterService().decodeShortVec(outputBytes, countAfter);
      const signatureSectionStartAfter = countAfter + signatureLengthAfter;
      const signatureSectionEndAfter =
        signatureSectionStartAfter + signatureCountAfter * 64;
      const msgOffsetAfter = signatureSectionEndAfter;

      expect(signatureCountAfter).toBe(signatureCountBefore);
      expect(signatureLengthAfter).toBe(signatureLengthBefore);
      expectAllZero(
        outputBytes,
        signatureSectionStartAfter,
        signatureSectionEndAfter,
      );

      const originalLayout = parseMessageAccountsAndBlockhashAuto(
        originalBytes,
        msgOffsetBefore,
      );
      const craftedLayout = parseMessageAccountsAndBlockhashAuto(
        outputBytes,
        msgOffsetAfter,
      );

      expect(craftedLayout.accounts.length).toBe(
        originalLayout.accounts.length,
      );

      expect(
        new PublicKey(craftedLayout.accounts[0]!).equals(newPayer.publicKey),
      ).toBe(true);

      for (let i = 1; i < originalLayout.accounts.length; i++) {
        expect(bytesToHex(craftedLayout.accounts[i]!)).toBe(
          bytesToHex(originalLayout.accounts[i]!),
        );
      }

      expect(bytesToHex(craftedLayout.recentBlockhash)).toBe(
        bytesToHex(originalLayout.recentBlockhash),
      );
    });
  });

  describe("malformed inputs", () => {
    const GENERIC_ERR =
      "Input is neither a valid legacy/v0 message nor a legacy/v0 transaction.";

    it("rejects inputs too short to contain a header", () => {
      const tooShort = Uint8Array.from([0x01, 0x00]); // < 3 bytes
      const badB64 = bytesToBase64(tooShort);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          badB64,
          newPayer.publicKey.toBase58(),
        ),
      ).toThrowError(GENERIC_ERR);
    });

    it("rejects inputs with header but not enough bytes for accounts", () => {
      // header (3 bytes) + accountCount shortvec (1) but no account keys or blockhash
      const bytes = Uint8Array.from([0x01, 0x00, 0x00, 0x01]);
      const badB64 = bytesToBase64(bytes);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          badB64,
          newPayer.publicKey.toBase58(),
        ),
      ).toThrowError(GENERIC_ERR);
    });

    it("handles shortvec that runs off the end of the buffer", () => {
      // header (3) + shortvec first byte with continuation, but no continuation byte
      const bytes = Uint8Array.from([0x01, 0x00, 0x00, 0x80]);
      const badB64 = bytesToBase64(bytes);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          badB64,
          newPayer.publicKey.toBase58(),
        ),
      ).toThrowError(GENERIC_ERR);
    });

    it("rejects when signatureCount > MAX_SIGNATURES", () => {
      // first shortvec = 65 (MAX_SIGNATURES + 1), then nothing else
      const bytes = Uint8Array.from([0x41]);
      const badB64 = bytesToBase64(bytes);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          badB64,
          newPayer.publicKey.toBase58(),
        ),
      ).toThrowError(GENERIC_ERR);
    });

    it("rejects when accountCount > MAX_ACCOUNTS", () => {
      // header + shortvec for 257 (0x81 0x02) accounts
      const bytes = Uint8Array.from([0x01, 0x00, 0x00, 0x81, 0x02]);
      const badB64 = bytesToBase64(bytes);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          badB64,
          newPayer.publicKey.toBase58(),
        ),
      ).toThrowError(GENERIC_ERR);
    });

    it("rejects v0-style first byte with unsupported version (versionByte & 0x7f !== 0)", () => {
      // versionByte = 0x81 => version = 1 (unsupported)
      const bytes = Uint8Array.from([0x81]);
      const badB64 = bytesToBase64(bytes);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          badB64,
          newPayer.publicKey.toBase58(),
        ),
      ).toThrowError(GENERIC_ERR);
    });
  });

  describe("invalid encodings", () => {
    it("throws a clear error for bad base58 payer key", () => {
      const msgB64 = buildLegacyMessageBase64();
      const badKey = "not a valid base58!!!";

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(msgB64, badKey),
      ).toThrowError("Failed to decode public key from base58.");
    });

    it("throws when base58 decodes to the wrong key length", () => {
      const msgB64 = buildLegacyMessageBase64();

      // 31 zero bytes to valid base58, wrong length
      const tooShortKeyBytes = new Uint8Array(31);
      const tooShortKey = bs58.encode(tooShortKeyBytes);

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          msgB64,
          tooShortKey,
        ),
      ).toThrowError(
        "Provided public key is not 32 bytes after base58 decode.",
      );
    });

    it("handles broken base64 input by rejecting it as not a valid message/transaction", () => {
      const definitelyNotB64 = "*definitely not a base 64 string*";
      const validPayer = newPayer.publicKey.toBase58();

      expect(() =>
        new TransactionCrafterService().getCraftedTransaction(
          definitelyNotB64,
          validPayer,
        ),
      ).toThrow();
    });
  });
});
