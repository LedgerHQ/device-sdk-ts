import { type Key } from "./Key";
import { type KeyPair } from "./KeyPair";

export enum Curve {
  K256, // secp256k1
  P256, // P-256
}

export enum EncryptionAlgo {
  AES256_GCM,
}

export enum HashAlgo {
  SHA256,
}

export interface CryptoService {
  // Generate a random buffer
  randomBytes(len: number): Uint8Array;

  // Compute a hash
  hash(bytes: Uint8Array, algo: HashAlgo): Uint8Array;

  // Compute a HMAC
  hmac(key: Uint8Array, message: Uint8Array, algo: HashAlgo): Uint8Array;

  // Generate a new random keypair
  createKeyPair(curve: Curve): Promise<KeyPair>;

  // Import a keypair
  importKeyPair(privateKey: Uint8Array, curve: Curve): KeyPair;

  // Generate a new random symmetric key
  createSymmetricKey(algo: EncryptionAlgo): Promise<Key>;

  // Import a symmetric key
  importSymmetricKey(keyMaterial: Uint8Array, algo: EncryptionAlgo): Key;
}
