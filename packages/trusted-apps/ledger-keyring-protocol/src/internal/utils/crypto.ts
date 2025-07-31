import { gcm } from "@noble/ciphers/aes";
import { etc, utils } from "@noble/secp256k1";

import { KeypairFromBytes } from "@api/app-binder/KeypairFromBytes";
import { type Keypair } from "@api/index";

const AES_BLOCK_SIZE = 16;

export class CryptoUtils {
  static async hash(bytes: Uint8Array): Promise<Uint8Array> {
    const buffer = await crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(buffer);
  }

  static randomKeypair(): Keypair {
    return new KeypairFromBytes(utils.randomPrivateKey());
  }

  static decrypt(
    secret: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array,
  ): Uint8Array {
    const key = secret;
    const cipher = gcm(key, iv.slice(0, AES_BLOCK_SIZE));
    return cipher.decrypt(ciphertext);
  }

  /**
   * DER specification: https://ledgerhq.atlassian.net/wiki/spaces/TrustServices/pages/3843719348/LNS+Arch+Common+Fields+for+Nano+certificates+and+descriptors#DER-Encoding-spec
   * See: https://ledgerhq.atlassian.net/wiki/spaces/TrustServices/pages/3736863735/LNS+Arch+Nano+Trusted+Names+Descriptor+Format+APIs
   * signature(r,s) = 0x30 & var(L,u8(~)) & sized(8*L, sig_components(r,s)); # DER encoding of the two 32 bytes signature components r & s
   * sig_components(r,s) = 0x02 & var(Lr,u8(~)) & sized(8*Lr, r) & 0x02 & var(Ls,u8(~)) & sized(8*Ls, s);
   */
  public static derEncode(r: bigint, s: bigint): Uint8Array {
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
