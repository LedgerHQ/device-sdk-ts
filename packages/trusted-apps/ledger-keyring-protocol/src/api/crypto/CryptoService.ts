import { Either } from "purify-ts";

import { LKRPParsingError } from "@api/model/Errors";

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

export type DecodedSignature = {
  prefix: { tag: 0x30; len: number };
  r: DERComponent;
  s: DERComponent;
};
type DERComponent = { tag: 0x02; len: number; value: Uint8Array };

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

  // Verify a signature
  verify(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Either<LKRPParsingError, boolean>;

  // Decode a DER encoded signature
  decodeSignature(
    signature: Uint8Array,
  ): Either<LKRPParsingError, DecodedSignature>;
}
