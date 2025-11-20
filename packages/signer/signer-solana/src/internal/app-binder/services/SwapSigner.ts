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

export class SwapSigner {
  public swap(inputBase64: string, newPayerBase58: string): string {
    const rawInput = this.fromBase64(inputBase64.replace(/\s+/g, ""));

    let newPayer: Uint8Array;
    try {
      newPayer = bs58.decode(String(newPayerBase58).trim());
    } catch {
      throw new Error(
        "Provided public key is not 32 bytes after base58 decode.",
      );
    }
    if (newPayer.length !== 32) {
      throw new Error(
        "Provided public key is not 32 bytes after base58 decode.",
      );
    }

    const output = new Uint8Array(rawInput.length);
    output.set(rawInput);

    const txInfo = this.detectTransaction(rawInput);
    if (txInfo) {
      output.set(newPayer, txInfo.payerOffset);
      this.zeroSignatures(
        output,
        txInfo.signatureSectionStart,
        txInfo.signatureCount,
      );
      return this.toBase64(output);
    }

    const msgInfo = this.detectMessage(rawInput);
    if (msgInfo) {
      output.set(newPayer, msgInfo.payerOffset);
      return this.toBase64(output);
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
      if (byte === undefined) throw new Error("shortvec decode overflow");
      value |= (byte & 0x7f) << shift;
      size += 1;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return { length: value, size };
  }

  // legacy (unversioned) message starting at messageOffset
  private locatePayerInLegacyMessage(bytes: Uint8Array, messageOffset: number) {
    const first = bytes[messageOffset];
    if (first === undefined) return null;
    if ((first & 0x80) !== 0) return null;

    let cursor = messageOffset;
    if (cursor + 3 > bytes.length) return null;

    const requiredSignatures = bytes[cursor];
    if (requiredSignatures && requiredSignatures < 1) return null; // strict
    cursor += 3; // header

    const { length: accountCount, size: accountLenSize } = this.decodeShortVec(
      bytes,
      cursor,
    );
    cursor += accountLenSize;
    if (accountCount < 1) return null;

    const accountKeysStart = cursor;
    const accountKeysBytes = accountCount * 32;

    // +32 for recent blockhash presence
    if (accountKeysStart + accountKeysBytes + 32 > bytes.length) return null;

    return { payerOffset: accountKeysStart };
  }

  // v0 message starting at messageOffset
  private locatePayerInV0Message(bytes: Uint8Array, messageOffset: number) {
    let cursor = messageOffset;

    const versionByte = bytes[cursor];
    // require versioned (high bit set)
    if (versionByte === undefined || (versionByte & 0x80) === 0) return null;
    cursor += 1; // skip version byte

    if (cursor + 3 > bytes.length) return null;

    const requiredSignatures = bytes[cursor];
    if (requiredSignatures && requiredSignatures < 1) return null; // strict
    cursor += 3; // header

    const { length: accountCount, size: accountLenSize } = this.decodeShortVec(
      bytes,
      cursor,
    );
    cursor += accountLenSize;
    if (accountCount < 1) return null;

    const accountKeysStart = cursor;
    const accountKeysBytes = accountCount * 32;

    if (accountKeysStart + accountKeysBytes + 32 > bytes.length) return null;
    return { payerOffset: accountKeysStart };
  }

  private detectMessage(bytes: Uint8Array): MessageDetection {
    // prefer v0 first to avoid accidental legacy parse
    const v0 = this.locatePayerInV0Message(bytes, 0);
    if (v0) return { payerOffset: v0.payerOffset, kind: "v0Message" };
    const legacy = this.locatePayerInLegacyMessage(bytes, 0);
    if (legacy)
      return { payerOffset: legacy.payerOffset, kind: "legacyMessage" };
    return null;
  }

  private detectTransaction(bytes: Uint8Array): TransactionDetection {
    // prefer v0 first after signatures; then legacy
    let cursor = 0;

    const { length: signatureCount, size: signatureLenSize } =
      this.decodeShortVec(bytes, cursor);
    cursor += signatureLenSize;

    if (signatureCount < 1) return null;

    const signaturesStart = cursor;
    const signaturesBytes = signatureCount * 64;
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

  private zeroSignatures(
    out: Uint8Array,
    signatureStart: number,
    signatureCount: number,
  ): void {
    for (let i = 0; i < signatureCount; i++) {
      const start = signatureStart + i * 64;
      out.fill(0, start, start + 64);
    }
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = "";
    for (const b of bytes) {
      if (typeof b !== "number") throw new Error("Invalid byte value");
      binary += String.fromCharCode(b);
    }
    try {
      return btoa(binary);
    } catch {
      return Buffer.from(bytes).toString("base64");
    }
  }

  private fromBase64(base64: string): Uint8Array {
    const clean = String(base64).replace(/\s+/g, "");
    try {
      const binary = atob(clean);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
      return out;
    } catch {
      return new Uint8Array(Buffer.from(clean, "base64"));
    }
  }
}
