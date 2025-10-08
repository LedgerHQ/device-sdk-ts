import { randomBytes } from "@noble/ciphers/webcrypto";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

import {
  type CryptoService,
  type Curve,
  type EncryptionAlgo,
  HashAlgo,
} from "@api/crypto/CryptoService";
import { type Key } from "@api/crypto/Key";
import { type KeyPair } from "@api/crypto/KeyPair";

import { NobleKey } from "./NobleKey";
import { NobleKeyPair } from "./NobleKeyPair";

export class NobleCryptoService implements CryptoService {
  randomBytes(len: number): Uint8Array {
    return randomBytes(len);
  }

  hash(bytes: Uint8Array, algo: HashAlgo): Uint8Array {
    switch (algo) {
      case HashAlgo.SHA256:
        return sha256(bytes);
      default:
        throw new Error("Unsupported hash algorithm", algo);
    }
  }

  hmac(key: Uint8Array, message: Uint8Array, algo: HashAlgo): Uint8Array {
    switch (algo) {
      case HashAlgo.SHA256:
        return hmac(sha256, key, message);
      default:
        throw new Error("Unsupported hash algorithm", algo);
    }
  }

  async createKeyPair(curve: Curve): Promise<KeyPair> {
    return await NobleKeyPair.generate(curve);
  }

  importKeyPair(privateKey: Uint8Array, curve: Curve): KeyPair {
    return NobleKeyPair.from(privateKey, curve);
  }

  async createSymmetricKey(algo: EncryptionAlgo): Promise<Key> {
    return await NobleKey.generate(algo);
  }

  importSymmetricKey(keyMaterial: Uint8Array, algo: EncryptionAlgo): Key {
    return NobleKey.from(keyMaterial, algo);
  }
}
