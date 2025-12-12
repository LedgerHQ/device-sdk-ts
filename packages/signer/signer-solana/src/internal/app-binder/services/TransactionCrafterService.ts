import {
  base64StringToBuffer,
  bufferToBase64String,
} from "@ledgerhq/device-management-kit";
import bs58 from "bs58";

type MessageDetection = {
  payerOffset: number;
  kind: "legacyMessage" | "v0Message";
} | null;

type TransactionDetection = {
  payerOffset: number;
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
      output.set(newPayer, transactionInfo.payerOffset);
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
      output.set(newPayer, msgInfo.payerOffset);
      return bufferToBase64String(output);
    }

    throw new Error(
      "Input is neither a valid legacy/v0 message nor a legacy/v0 transaction.",
    );
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

  // legacy message starting at messageOffset
  private locatePayerInLegacyMessage(bytes: Uint8Array, messageOffset: number) {
    const result = this.locatePayerInMessage(bytes, messageOffset, {
      versioned: false,
    });
    if (!result) return null;
    return { payerOffset: result.payerOffset };
  }

  // v0 message starting at messageOffset
  private locatePayerInV0Message(bytes: Uint8Array, messageOffset: number) {
    const result = this.locatePayerInMessage(bytes, messageOffset, {
      versioned: true,
    });
    if (!result) return null;
    return { payerOffset: result.payerOffset };
  }

  private detectMessage(bytes: Uint8Array): MessageDetection {
    // prefer v0 first to avoid accidental legacy parse
    const v0 = this.locatePayerInV0Message(bytes, 0);
    if (v0) return { payerOffset: v0.payerOffset, kind: "v0Message" };

    const legacy = this.locatePayerInLegacyMessage(bytes, 0);
    if (legacy) {
      return { payerOffset: legacy.payerOffset, kind: "legacyMessage" };
    }

    return null;
  }

  private detectTransaction(bytes: Uint8Array): TransactionDetection {
    // prefer v0 first after signatures, then legacy
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

    const v0 = this.locatePayerInV0Message(bytes, messageOffset);
    if (v0) {
      return {
        payerOffset: v0.payerOffset,
        signatureSectionStart: signaturesStart,
        signatureCount,
        kind: "v0Tx",
      };
    }

    const legacy = this.locatePayerInLegacyMessage(bytes, messageOffset);
    if (legacy) {
      return {
        payerOffset: legacy.payerOffset,
        signatureSectionStart: signaturesStart,
        signatureCount,
        kind: "legacyTx",
      };
    }

    return null;
  }
}
