export class HexStringUtils {
  /**
   * Decode a non-empty even-length hex string (with optional `0x` prefix)
   * into a Uint8Array. Throws on empty input, odd length, or non-hex
   * characters — the empty case is rejected explicitly so callers can't
   * silently produce a zero-length descriptor.
   */
  static hexToBytes(hex: string): Uint8Array {
    const s = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (s.length === 0) {
      throw new Error("HexStringUtils.hexToBytes: empty hex string");
    }
    if (s.length % 2 !== 0) {
      throw new Error(
        `HexStringUtils.hexToBytes: odd-length hex string (${s.length})`,
      );
    }
    if (!/^[0-9a-fA-F]+$/.test(s)) {
      throw new Error("HexStringUtils.hexToBytes: non-hex characters");
    }
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  static stringToHex(str: string): string {
    let hexString = "";
    for (let i = 0; i < str.length; i++) {
      const hex = str.charCodeAt(i).toString(16);
      hexString += hex.padStart(2, "0"); // Ensure each hex code is at least 2 characters long
    }
    return hexString;
  }

  static appendSignatureToPayload(
    payload: string,
    signature: string,
    tag: string,
  ): string {
    // Ensure correct padding
    if (signature.length % 2 !== 0) {
      signature = "0" + signature;
    }
    // TLV encoding as according to trusted name documentation
    let signatureLength = (signature.length / 2).toString(16);
    if (signatureLength.length % 2 !== 0) {
      signatureLength = "0" + signatureLength;
    }

    return `${payload}${tag}${signatureLength}${signature}`;
  }
}
