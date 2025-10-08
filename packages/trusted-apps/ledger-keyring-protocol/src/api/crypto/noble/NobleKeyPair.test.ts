import { Curve } from "@api/crypto/CryptoService";
import { SigFormat } from "@api/crypto/KeyPair";

import { NobleKeyPair } from "./NobleKeyPair";

describe("NobleKeyPair", () => {
  const testData = new TextEncoder().encode("Test Data");

  it("should generate a key pair with correct public key", async () => {
    const keyPair = await NobleKeyPair.generate(Curve.K256);
    const publicKey = keyPair.getPublicKey();
    expect(publicKey).toBeDefined();
    expect(publicKey.byteLength).toBeGreaterThan(0);
  });

  it("should create a key pair from a private key", () => {
    const privateKey = new Uint8Array(32).fill(1);
    const keyPair = NobleKeyPair.from(privateKey, Curve.K256);
    expect(keyPair.getPublicKey()).toBeDefined();
  });

  it("should sign and verify data correctly", async () => {
    const keyPair = await NobleKeyPair.generate(Curve.K256);
    const signature = await keyPair.sign(testData);
    const isVerified = await keyPair.verify(testData, signature);
    expect(isVerified).toBeTruthy();
  });

  it("should sign and verify data correctly, in DER format", async () => {
    const keyPair = await NobleKeyPair.generate(Curve.K256);
    const signature = await keyPair.sign(testData, SigFormat.DER);
    const isVerified = await keyPair.verify(testData, signature, SigFormat.DER);
    expect(isVerified).toBeTruthy();
  });

  it("should derive a shared secret with another public key", async () => {
    const keyPair = await NobleKeyPair.generate(Curve.K256);
    const otherKeyPair = await NobleKeyPair.generate(Curve.K256);
    const sharedSecret1 = await keyPair.deriveSharedSecret(
      otherKeyPair.getPublicKey(),
    );
    const sharedSecret2 = await otherKeyPair.deriveSharedSecret(
      keyPair.getPublicKey(),
    );

    expect(sharedSecret1).toBeDefined();
    expect(sharedSecret1.byteLength).toBeGreaterThan(0);
    expect(sharedSecret1).toStrictEqual(sharedSecret2);
  });

  it("should convert public key to hex string", async () => {
    const keyPair = await NobleKeyPair.generate(Curve.K256);
    const hexPublicKey = keyPair.getPublicKeyToHex();
    expect(typeof hexPublicKey).toBe("string");
    expect(hexPublicKey.length).toBeGreaterThan(0);
  });
});
