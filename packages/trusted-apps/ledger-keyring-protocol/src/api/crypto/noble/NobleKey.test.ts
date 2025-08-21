import { AES256_BLOCK_SIZE, AES256_KEY_SIZE } from "@api/crypto/Key";

import { NobleKey } from "./NobleKey";

describe("NobleKey", () => {
  const testData = new TextEncoder().encode("Test Data");

  it("should encrypt and decrypt data correctly", async () => {
    const key = await NobleKey.generate();
    const iv = new Uint8Array(AES256_BLOCK_SIZE).fill(0x02);
    const encryptedData = await key.encrypt(iv, testData);
    const decryptedData = await key.decrypt(iv, encryptedData);

    expect(encryptedData).not.toEqual(testData);
    expect(decryptedData).toEqual(testData);
  });

  it("should encrypt and decrypt data from key material", async () => {
    const keyMaterial = new Uint8Array(AES256_KEY_SIZE).fill(0x01);
    const key = NobleKey.from(keyMaterial);
    const iv = new Uint8Array(AES256_BLOCK_SIZE).fill(0x02);
    const encryptedData = await key.encrypt(iv, testData);
    const decryptedData = await key.decrypt(iv, encryptedData);

    expect(encryptedData).not.toEqual(testData);
    expect(decryptedData).toEqual(testData);
  });
});
