import { getPublicKey, signAsync } from "@noble/secp256k1";

import { type Keypair } from "@api/index";
import { CryptoUtils } from "@internal/utils/crypto";
import { bytesToHex } from "@internal/utils/hex";

export class KeypairFromBytes implements Keypair {
  constructor(
    private readonly privateKey: Uint8Array,
    private readonly publicKey = getPublicKey(privateKey),
  ) {}

  pubKeyToU8a(): Uint8Array {
    return this.publicKey;
  }

  pubKeyToHex(): string {
    return bytesToHex(this.publicKey);
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const { r, s } = await signAsync(message, this.privateKey);
    return CryptoUtils.derEncode(r, s);
  }
}
