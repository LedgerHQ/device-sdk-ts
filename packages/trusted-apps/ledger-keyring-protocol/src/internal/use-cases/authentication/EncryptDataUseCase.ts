import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  type CryptoService,
  Curve,
  EncryptionAlgo,
  HashAlgo,
} from "@api/crypto/CryptoService";
import { AES256_BLOCK_SIZE } from "@api/crypto/Key";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class EncryptDataUseCase {
  constructor(
    @inject(externalTypes.CryptoService)
    private cryptoService: CryptoService,
  ) {}

  async execute(
    encryptionKey: Uint8Array,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    // Derive the shared secret using ECDH with an ephemeral keypair
    const privateKey = this.cryptoService.importKeyPair(
      encryptionKey,
      Curve.K256,
    );
    const ephemeralKeypair = await this.cryptoService.createKeyPair(Curve.K256);
    const sharedSecret = await privateKey.deriveSharedSecret(
      ephemeralKeypair.getPublicKey(),
    );

    // Key derivation using HMAC-SHA256
    const key = this.cryptoService.hmac(
      new Uint8Array(),
      sharedSecret.slice(1),
      HashAlgo.SHA256,
    );

    // Generate a random IV (nonce)
    const iv = this.cryptoService.randomBytes(16);

    // Encrypt data
    const symmetricKey = this.cryptoService.importSymmetricKey(
      key,
      EncryptionAlgo.AES256_GCM,
    );
    const ciphertext = await symmetricKey.encrypt(iv, data);
    const encryptedData = ciphertext.subarray(0, -AES256_BLOCK_SIZE);
    const tag = ciphertext.subarray(-AES256_BLOCK_SIZE);

    // Serialize the result
    return new ByteArrayBuilder()
      .add8BitUIntToData(0) // Version of the format
      .addBufferToData(ephemeralKeypair.getPublicKey())
      .addBufferToData(iv)
      .addBufferToData(tag)
      .addBufferToData(encryptedData)
      .build();
  }
}
