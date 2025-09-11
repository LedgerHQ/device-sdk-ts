import { randomBytes } from "@noble/ciphers/webcrypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { Either, Left, Right } from "purify-ts";

import {
  type CryptoService,
  type Curve,
  type DecodedSignature,
  type EncryptionAlgo,
  HashAlgo,
} from "@api/crypto/CryptoService";
import { type Key } from "@api/crypto/Key";
import { type KeyPair } from "@api/crypto/KeyPair";
import { LKRPParsingError } from "@api/model/Errors";
import { numToHex } from "@internal/utils/log";

import { NobleKey } from "./NobleKey";
import { NobleKeyPair } from "./NobleKeyPair";

const PRIVATE_KEY_SIZE = 32;

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

  verify(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Either<LKRPParsingError, boolean> {
    return this.decodeSignature(signature)
      .chain(({ r, s }) => {
        const compactSig = Uint8Array.from([...r.value, ...s.value]);
        return Either.encase(() =>
          secp256k1.verify(compactSig, message, publicKey, {
            prehash: false,
          }),
        );
      })
      .mapLeft((error) => new LKRPParsingError(String(error)));
  }

  /**
   * Signature DER format:
   * [0x30 totalLength 0x02 rLength ...R 0x02 sLength ...S]
   */
  decodeSignature(
    signature: Uint8Array,
  ): Either<LKRPParsingError, DecodedSignature> {
    const [derTag, len, rTag, rLen, ...restA] = signature;
    const r = formatComponent(restA.slice(0, rLen));
    const [sTag, sLen, ...restB] = restA.slice(rLen);
    const s = formatComponent(restB.slice(0, sLen));

    if (
      derTag !== 0x30 ||
      rTag !== 0x02 ||
      sTag !== 0x02 ||
      !len ||
      !rLen ||
      !sLen
    ) {
      return Left(
        new LKRPParsingError(
          `Invalid Signature format: ${[derTag, len, rTag, "...R", sTag, "...L"]
            .map((x) => (typeof x === "number" ? numToHex(x) : String(x)))
            .join(" ")}`,
        ),
      );
    }

    return Right({
      prefix: { tag: derTag, len: len },
      r: { tag: rTag, len: rLen, value: r },
      s: { tag: sTag, len: sLen, value: s },
    });

    function formatComponent(arr: number[]): Uint8Array {
      const diff = PRIVATE_KEY_SIZE - arr.length;
      if (diff < 0) {
        return Uint8Array.from(arr.slice(-diff)); // truncate extra bytes from the start
      } else if (diff > 0) {
        const leadingZeros = Array.from({ length: diff }, () => 0);
        return Uint8Array.from([...leadingZeros, ...arr]);
      }
      return Uint8Array.from(arr);
    }
  }
}
