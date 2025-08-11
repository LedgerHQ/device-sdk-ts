import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

import { KeypairFromBytes } from "@api/index";
import { AES_BLOCK_SIZE, CryptoUtils } from "@internal/utils/crypto";

export class EncryptDataUseCase {
  execute(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    // Derive the shared secret using ECDH with an ephemeral keypair
    const privateKey = new KeypairFromBytes(encryptionKey);
    const ephemeralKeypair = CryptoUtils.randomKeypair();
    const sharedSecret = privateKey
      .ecdh(ephemeralKeypair.pubKeyToU8a())
      .slice(1);

    // Key derivation using HMAC-SHA256
    const key = CryptoUtils.hmac(new Uint8Array(), sharedSecret);

    // Generate a random IV (nonce)
    const iv = CryptoUtils.randomBytes(16);

    // Encrypt data
    const ciphertext = CryptoUtils.encrypt(key, iv, data);
    const encryptedData = ciphertext.subarray(0, -AES_BLOCK_SIZE);
    const tag = ciphertext.subarray(-AES_BLOCK_SIZE);

    // Serialize the result
    return new ByteArrayBuilder()
      .add8BitUIntToData(0) // Version of the format
      .addBufferToData(ephemeralKeypair.pubKeyToU8a())
      .addBufferToData(iv)
      .addBufferToData(tag)
      .addBufferToData(encryptedData)
      .build();
  }
}
