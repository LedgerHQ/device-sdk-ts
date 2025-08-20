import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { Curve, EncryptionAlgo, HashAlgo } from "@api/crypto/CryptoService";

import { NobleCryptoService } from "./NobleCryptoService";
import { NobleKey } from "./NobleKey";
import { NobleKeyPair } from "./NobleKeyPair";

describe("NobleCryptoService", () => {
  let cryptoService: NobleCryptoService;

  beforeEach(() => {
    cryptoService = new NobleCryptoService();
  });

  it("should generate random bytes of correct length", () => {
    const length = 32;
    const bytes = cryptoService.randomBytes(length);
    expect(bytes.length).toBe(length);
  });

  it("should hash data correctly with SHA256", () => {
    const data = new TextEncoder().encode("test");
    const hashResult = cryptoService.hash(data, HashAlgo.SHA256);
    expect(hashResult).toEqual(
      hexaStringToBuffer(
        "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      )!,
    );
  });

  it("should compute HMAC correctly with SHA256", () => {
    const key = new Uint8Array(32).fill(0x61);
    const message = new TextEncoder().encode("test message");
    const hmacResult = cryptoService.hmac(key, message, HashAlgo.SHA256);
    expect(hmacResult).toEqual(
      hexaStringToBuffer(
        "0b19ad8fef1660f7a191465effeea922079633ada962f52cb60103d9935cc460",
      )!,
    );
  });

  it("should create a key pair", async () => {
    const keyPair = await cryptoService.createKeyPair(Curve.K256);
    expect(keyPair instanceof NobleKeyPair).toBeTruthy();
  });

  it("should import a key pair", () => {
    const privateKey = new Uint8Array(32).fill(1);
    const keyPair = cryptoService.importKeyPair(privateKey, Curve.K256);
    expect(keyPair instanceof NobleKeyPair).toBeTruthy();
  });

  it("should create a symmetric key", async () => {
    const symmetricKey = await cryptoService.createSymmetricKey(
      EncryptionAlgo.AES256_GCM,
    );
    expect(symmetricKey instanceof NobleKey).toBeTruthy();
  });

  it("should import a symmetric key", () => {
    const keyMaterial = new Uint8Array(32).fill(1);
    const symmetricKey = cryptoService.importSymmetricKey(
      keyMaterial,
      EncryptionAlgo.AES256_GCM,
    );
    expect(symmetricKey instanceof NobleKey).toBeTruthy();
  });
});
