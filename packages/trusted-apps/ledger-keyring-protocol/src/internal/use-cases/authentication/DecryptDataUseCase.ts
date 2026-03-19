import { ByteArrayParser } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import {
  type CryptoService,
  Curve,
  EncryptionAlgo,
  HashAlgo,
} from "@api/crypto/CryptoService";
import { LKRPParsingError } from "@api/model/Errors";
import { externalTypes } from "@internal/externalTypes";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

const EPHEMERAL_PUBLIC_KEY_LENGTH = 33;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

@injectable()
export class DecryptDataUseCase {
  constructor(
    @inject(externalTypes.CryptoService)
    private cryptoService: CryptoService,
  ) {}

  // TODO better return type instead of throw on errors
  async execute(
    encryptionKey: Uint8Array,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    const parser = new ByteArrayParser(data);
    if (parser.extract8BitUInt() !== 0) {
      throw new LKRPParsingError("Unsupported serialization version");
    }
    const required = (value: Uint8Array | undefined, field: string) =>
      Maybe.fromNullable(value).toEither(
        new LKRPParsingError(`Missing ${field} field`),
      );

    return eitherSeqRecord({
      ephemeralPublicKey: () =>
        required(
          parser.extractFieldByLength(EPHEMERAL_PUBLIC_KEY_LENGTH),
          "ephemeral public key",
        ),
      iv: () => required(parser.extractFieldByLength(IV_LENGTH), "IV"),
      tag: () => required(parser.extractFieldByLength(TAG_LENGTH), "tag"),
      encryptedData: () =>
        required(
          parser.extractFieldByLength(parser.getUnparsedRemainingLength()),
          "encrypted data",
        ),
    })
      .map(async ({ ephemeralPublicKey, iv, tag, encryptedData }) => {
        // Derive the shared secret using ECDH with an ephemeral keyPair
        const privateKey = this.cryptoService.importKeyPair(
          encryptionKey,
          Curve.K256,
        );
        const sharedSecret =
          await privateKey.deriveSharedSecret(ephemeralPublicKey);

        // Key derivation using HMAC-SHA256
        const key = this.cryptoService.hmac(
          new Uint8Array(),
          sharedSecret.slice(1),
          HashAlgo.SHA256,
        );

        // Decrypt the data
        const symmetricKey = this.cryptoService.importSymmetricKey(
          key,
          EncryptionAlgo.AES256_GCM,
        );
        const ciphertext = new Uint8Array([...encryptedData, ...tag]);
        const cleartext = await symmetricKey.decrypt(iv, ciphertext);
        return cleartext;
      })
      .caseOf({
        Left: (error) => {
          throw error;
        },
        Right: (cleartext) => cleartext,
      });
  }
}
