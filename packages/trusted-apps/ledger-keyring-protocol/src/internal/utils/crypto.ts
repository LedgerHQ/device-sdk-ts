import { etc, signAsync } from "@noble/secp256k1";

export class CryptoUtils {
  static async hash(bytes: Uint8Array): Promise<Uint8Array> {
    const buffer = await crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(buffer);
  }

  static async sign(msg: Uint8Array, priv: Uint8Array): Promise<Uint8Array> {
    const { r, s } = await signAsync(msg, priv);
    return this.derEncode(r, s);
  }

  /**
   * DER specification: https://ledgerhq.atlassian.net/wiki/spaces/TrustServices/pages/3843719348/LNS+Arch+Common+Fields+for+Nano+certificates+and+descriptors#DER-Encoding-spec
   * See: https://ledgerhq.atlassian.net/wiki/spaces/TrustServices/pages/3736863735/LNS+Arch+Nano+Trusted+Names+Descriptor+Format+APIs
   * signature(r,s) = 0x30 & var(L,u8(~)) & sized(8*L, sig_components(r,s)); # DER encoding of the two 32 bytes signature components r & s
   * sig_components(r,s) = 0x02 & var(Lr,u8(~)) & sized(8*Lr, r) & 0x02 & var(Ls,u8(~)) & sized(8*Ls, s);
   */
  private static derEncode(r: bigint, s: bigint): Uint8Array {
    const rBytes = this.encodeSigComponent(r);
    const sBytes = this.encodeSigComponent(s);
    const length = rBytes.length + sBytes.length;
    return Uint8Array.from([0x30, length, ...rBytes, ...sBytes]);
  }

  private static encodeSigComponent(number: bigint): Uint8Array {
    const bytes = etc.numberToBytesBE(number);
    const padding = bytes[0] && bytes[0] >= 0x80 ? [0x00] : []; // Add padding if the first byte is >= 0x80 to ensure positive encoding
    const length = bytes.length + padding.length;
    return Uint8Array.from([0x02, length, ...padding, ...bytes]);
  }
}
