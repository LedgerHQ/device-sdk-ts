import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import type { CurveFn } from "@noble/curves/abstract/weierstrass.js";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

import { Curve } from "@api/crypto/CryptoService";
import { type KeyPair, SigFormat } from "@api/crypto/KeyPair";

export class NobleKeyPair implements KeyPair {
  static async generate(curve: Curve): Promise<NobleKeyPair> {
    const curveImpl = NobleKeyPair.getCurve(curve);
    const { secretKey, publicKey } = curveImpl.keygen();
    return new NobleKeyPair(curveImpl, secretKey, publicKey);
  }

  static from(privateKey: Uint8Array, curve: Curve): NobleKeyPair {
    const curveImpl = NobleKeyPair.getCurve(curve);
    const publicKey = curveImpl.getPublicKey(privateKey);
    return new NobleKeyPair(curveImpl, privateKey, publicKey);
  }

  private static getCurve(curve: Curve): CurveFn {
    switch (curve) {
      case Curve.K256:
        return secp256k1;
      case Curve.P256:
        return p256;
      default:
        throw new Error(`Unsupported curve ${curve}`);
    }
  }

  private constructor(
    private curve: CurveFn,
    private privateKey: Uint8Array,
    private publicKey: Uint8Array,
  ) {}

  async sign(data: Uint8Array, format?: SigFormat): Promise<Uint8Array> {
    return this.curve
      .sign(data, this.privateKey)
      .toBytes(format === SigFormat.DER ? "der" : "compact");
  }

  async verify(
    data: Uint8Array,
    signature: Uint8Array,
    format?: SigFormat,
  ): Promise<boolean> {
    return this.curve.verify(signature, data, this.publicKey, {
      format: format === SigFormat.DER ? "der" : "compact",
    });
  }

  async deriveSharedSecret(
    peerPublicKey: Uint8Array,
    isCompressed: boolean = true,
  ): Promise<Uint8Array> {
    return this.curve.getSharedSecret(
      this.privateKey,
      peerPublicKey,
      isCompressed,
    );
  }

  getPublicKey(): Uint8Array {
    return this.publicKey;
  }

  getPublicKeyToHex(): string {
    return bufferToHexaString(this.publicKey, false);
  }
}
