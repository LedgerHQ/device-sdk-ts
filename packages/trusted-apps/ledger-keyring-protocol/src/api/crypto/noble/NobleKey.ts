import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";

import { EncryptionAlgo } from "@api/crypto/CryptoService";
import { AES256_BLOCK_SIZE, AES256_KEY_SIZE, type Key } from "@api/crypto/Key";

export class NobleKey implements Key {
  static async generate(
    algo: EncryptionAlgo = EncryptionAlgo.AES256_GCM,
  ): Promise<NobleKey> {
    if (algo !== EncryptionAlgo.AES256_GCM) {
      throw new Error(`Unsupported encryption algorithm ${algo}`);
    }
    return new NobleKey(randomBytes(AES256_KEY_SIZE));
  }

  static from(
    keyMaterial: Uint8Array,
    algo: EncryptionAlgo = EncryptionAlgo.AES256_GCM,
  ): NobleKey {
    if (algo !== EncryptionAlgo.AES256_GCM) {
      throw new Error(`Unsupported encryption algorithm ${algo}`);
    }
    return new NobleKey(keyMaterial);
  }

  private constructor(private key: Uint8Array) {}

  async encrypt(iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cipher = gcm(this.key, iv.slice(0, AES256_BLOCK_SIZE));
    return cipher.encrypt(data);
  }

  async decrypt(
    iv: Uint8Array,
    encryptedData: Uint8Array,
  ): Promise<Uint8Array> {
    const cipher = gcm(this.key, iv.slice(0, AES256_BLOCK_SIZE));
    return cipher.decrypt(encryptedData);
  }
}
