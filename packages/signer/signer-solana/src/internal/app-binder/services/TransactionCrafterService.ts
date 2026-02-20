import {
  base64StringToBuffer,
  bufferToBase64String,
} from "@ledgerhq/device-management-kit";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

type MessageDetection = {
  accountKeysStart: number;
  accountCount: number;
  kind: "legacyMessage" | "v0Message";
} | null;

type TransactionDetection = {
  accountKeysStart: number;
  accountCount: number;
  signatureSectionStart: number;
  signatureCount: number;
  kind: "legacyTx" | "v0Tx";
} | null;

const PUBLIC_KEY_LENGTH = 32;
const SIGNATURE_LENGTH = 64;
const MAX_SIGNATURES = 64;
const MAX_ACCOUNTS = 256;

export class TransactionCrafterService {
  public getCraftedTransaction(
    transactionBase64: string,
    newPayerBase58: string,
  ): string {
    const rawInput = base64StringToBuffer(transactionBase64);
    if (rawInput === null) {
      throw new Error("Input is not a valid base64 string.");
    }

    let newPayer: Uint8Array;
    try {
      newPayer = bs58.decode(String(newPayerBase58).trim());
    } catch {
      throw new Error("Failed to decode public key from base58.");
    }

    if (newPayer.length !== PUBLIC_KEY_LENGTH) {
      throw new Error(
        `Provided public key is not ${PUBLIC_KEY_LENGTH} bytes after base58 decode.`,
      );
    }

    const output = new Uint8Array(rawInput.length);
    output.set(rawInput);

    const transactionInfo = this.detectTransaction(rawInput);
    if (transactionInfo) {
      this.applyReplacements(
        output,
        rawInput,
        transactionInfo.accountKeysStart,
        transactionInfo.accountCount,
        newPayer,
      );
      output.fill(
        0,
        transactionInfo.signatureSectionStart,
        transactionInfo.signatureSectionStart +
          transactionInfo.signatureCount * SIGNATURE_LENGTH,
      );
      return bufferToBase64String(output);
    }

    const msgInfo = this.detectMessage(rawInput);
    if (msgInfo) {
      this.applyReplacements(
        output,
        rawInput,
        msgInfo.accountKeysStart,
        msgInfo.accountCount,
        newPayer,
      );
      return bufferToBase64String(output);
    }

    throw new Error(
      "Input is neither a valid legacy/v0 message nor a legacy/v0 transaction.",
    );
  }

  private applyReplacements(
    output: Uint8Array,
    rawInput: Uint8Array,
    accountKeysStart: number,
    accountCount: number,
    newPayer: Uint8Array,
  ): void {
    const accountKeys: Uint8Array[] = [];
    for (let i = 0; i < accountCount; i++) {
      const start = accountKeysStart + i * PUBLIC_KEY_LENGTH;
      accountKeys.push(rawInput.slice(start, start + PUBLIC_KEY_LENGTH));
    }

    const oldPayerBytes = accountKeys[0]!;
    const oldPayerPK = new PublicKey(oldPayerBytes);
    const newPayerPK = new PublicKey(newPayer);

    const replacements: Map<number, Uint8Array> = new Map();

    for (let i = 0; i < accountCount; i++) {
      const offset = accountKeysStart + i * PUBLIC_KEY_LENGTH;
      const key = accountKeys[i]!;

      if (this.bytesEqual(key, oldPayerBytes)) {
        replacements.set(offset, newPayer);
        continue;
      }

      this.detectAndReplaceATA(
        key,
        offset,
        accountKeys,
        oldPayerPK,
        newPayerPK,
        replacements,
      );
    }

    for (const [offset, bytes] of replacements) {
      output.set(bytes, offset);
    }
  }

  private detectAndReplaceATA(
    key: Uint8Array,
    offset: number,
    accountKeys: Uint8Array[],
    oldPayer: PublicKey,
    newPayer: PublicKey,
    replacements: Map<number, Uint8Array>,
  ): void {
    const keyPK = new PublicKey(key);
    for (const candidateMintBytes of accountKeys) {
      const candidateMint = new PublicKey(candidateMintBytes);
      for (const tokenProgram of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
        try {
          const expectedATA = getAssociatedTokenAddressSync(
            candidateMint,
            oldPayer,
            true,
            tokenProgram,
          );
          if (expectedATA.equals(keyPK)) {
            const newATA = getAssociatedTokenAddressSync(
              candidateMint,
              newPayer,
              true,
              tokenProgram,
            );
            replacements.set(offset, newATA.toBytes());
            return;
          }
        } catch {
          /* not a valid derivation for this combo */
        }
      }
    }
  }

  private bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Solana shortvec decode (variable-length unsigned integer)
  decodeShortVec(
    bytes: Uint8Array,
    offset: number,
  ): { length: number; size: number } {
    let value = 0;
    let size = 0;
    let shift = 0;

    while (true) {
      const byte = bytes[offset + size];
      if (byte === undefined) {
        throw new Error("shortvec decode overflow");
      }

      value |= (byte & 0x7f) << shift;
      size += 1;

      if ((byte & 0x80) === 0) {
        break;
      }

      shift += 7;

      if (shift >= 35) {
        throw new Error("shortvec too long");
      }
    }

    return { length: value, size };
  }

  // decodeShortVec wrapper that treats any decoding error as "not a valid message/transaction" rather than throwing
  private tryDecodeShortVec(
    bytes: Uint8Array,
    offset: number,
  ): { length: number; size: number } | null {
    try {
      return this.decodeShortVec(bytes, offset);
    } catch {
      return null;
    }
  }

  // Shared logic for both legacy and v0 messages
  private locatePayerInMessage(
    bytes: Uint8Array,
    messageOffset: number,
    opts: { versioned: boolean },
  ) {
    let cursor = messageOffset;

    if (opts.versioned) {
      const versionByte = bytes[cursor];
      // require versioned (high bit set)
      if (versionByte === undefined || (versionByte & 0x80) === 0) return null;

      const version = versionByte & 0x7f;
      // only support v0, reject future versions so we don't mis-parse
      if (version !== 0) return null;

      cursor += 1; // skip version byte
    } else {
      const first = bytes[cursor];
      if (first === undefined) return null;

      // legacy messages must NOT have high bit set on first byte (that's v0)
      if ((first & 0x80) !== 0) return null;
    }

    // header: required_signatures, num_readonly_signed, num_readonly_unsigned
    if (cursor + 3 > bytes.length) return null;

    const requiredSignatures = bytes[cursor];
    const numReadonlySigned = bytes[cursor + 1];
    const numReadonlyUnsigned = bytes[cursor + 2];

    if (requiredSignatures === undefined) return null;

    // strict: require at least one signer
    if (requiredSignatures < 1) return null;

    cursor += 3; // move past header

    const accountCountInfo = this.tryDecodeShortVec(bytes, cursor);
    if (!accountCountInfo) return null;

    const { length: accountCount, size: accountLenSize } = accountCountInfo;

    if (accountCount < 1 || accountCount > MAX_ACCOUNTS) return null;

    // required signatures cannot exceed total accounts
    if (requiredSignatures > accountCount) return null;

    cursor += accountLenSize;

    const accountKeysStart = cursor;
    const accountKeysBytes = accountCount * PUBLIC_KEY_LENGTH;

    // ensure space for all account keys plus recent blockhash (32 bytes)
    if (
      accountKeysStart + accountKeysBytes + PUBLIC_KEY_LENGTH >
      bytes.length
    ) {
      return null;
    }

    // payer is always the first account key (index 0)
    return {
      payerOffset: accountKeysStart,
      requiredSignatures,
      numReadonlySigned,
      numReadonlyUnsigned,
      accountCount,
    };
  }

  private locateMessageInfo(bytes: Uint8Array, messageOffset: number) {
    const v0 = this.locatePayerInMessage(bytes, messageOffset, {
      versioned: true,
    });
    if (v0) {
      return {
        accountKeysStart: v0.payerOffset,
        accountCount: v0.accountCount,
        kind: "v0" as const,
      };
    }

    const legacy = this.locatePayerInMessage(bytes, messageOffset, {
      versioned: false,
    });
    if (legacy) {
      return {
        accountKeysStart: legacy.payerOffset,
        accountCount: legacy.accountCount,
        kind: "legacy" as const,
      };
    }

    return null;
  }

  private detectMessage(bytes: Uint8Array): MessageDetection {
    const info = this.locateMessageInfo(bytes, 0);
    if (!info) return null;
    return {
      accountKeysStart: info.accountKeysStart,
      accountCount: info.accountCount,
      kind: info.kind === "v0" ? "v0Message" : "legacyMessage",
    };
  }

  private detectTransaction(bytes: Uint8Array): TransactionDetection {
    let cursor = 0;

    const signatureInfo = this.tryDecodeShortVec(bytes, cursor);
    if (!signatureInfo) return null;

    const { length: signatureCount, size: signatureLengthSize } = signatureInfo;

    if (signatureCount < 1 || signatureCount > MAX_SIGNATURES) {
      return null;
    }

    cursor += signatureLengthSize;

    const signaturesStart = cursor;
    const signaturesBytes = signatureCount * SIGNATURE_LENGTH;
    const messageOffset = signaturesStart + signaturesBytes;

    if (messageOffset > bytes.length) return null;

    const info = this.locateMessageInfo(bytes, messageOffset);
    if (!info) return null;

    return {
      accountKeysStart: info.accountKeysStart,
      accountCount: info.accountCount,
      signatureSectionStart: signaturesStart,
      signatureCount,
      kind: info.kind === "v0" ? "v0Tx" : "legacyTx",
    };
  }
}
