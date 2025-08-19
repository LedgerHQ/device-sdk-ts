import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { getPublicKey, getSharedSecret, signAsync } from "@noble/secp256k1";

import { type Keypair } from "@api/index";
import { CryptoUtils } from "@internal/utils/crypto";

export class KeypairFromBytes implements Keypair {
  constructor(
    private readonly privateKey: Uint8Array,
    private readonly publicKey = getPublicKey(privateKey),
  ) {}

  pubKeyToU8a(): Uint8Array {
    return this.publicKey;
  }

  pubKeyToHex(): string {
    return bufferToHexaString(this.publicKey, false);
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const { r, s } = await signAsync(message, this.privateKey);
    return CryptoUtils.derEncode(r, s);
  }

  ecdh(publicKey: Uint8Array, isCompressed = true): Uint8Array {
    return getSharedSecret(this.privateKey, publicKey, isCompressed);
  }
}
