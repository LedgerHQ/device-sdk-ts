import { ByteArrayParser } from "@ledgerhq/device-management-kit";
import { Maybe } from "purify-ts";

import { LKRPParsingError } from "@api/app-binder/Errors";
import { KeypairFromBytes } from "@api/index";
import { CryptoUtils } from "@internal/utils/crypto";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

export class DecryptDataUseCase {
  execute(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
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
        required(parser.extractFieldByLength(33), "ephemeral public key"),
      iv: () => required(parser.extractFieldByLength(16), "IV"),
      tag: () => required(parser.extractFieldByLength(16), "tag"),
      encryptedData: () =>
        required(
          parser.extractFieldByLength(parser.getUnparsedRemainingLength()),
          "encrypted data",
        ),
    })
      .map(({ ephemeralPublicKey, iv, tag, encryptedData }) => {
        // Derive the shared secret using ECDH with an ephemeral keypair
        const privateKey = new KeypairFromBytes(encryptionKey);
        const sharedSecret = privateKey.ecdh(ephemeralPublicKey).slice(1);

        // Key derivation using HMAC-SHA256
        const key = CryptoUtils.hmac(new Uint8Array(), sharedSecret);

        // Decrypt the data
        const ciphertext = new Uint8Array([...encryptedData, ...tag]);
        const cleartext = CryptoUtils.decrypt(key, iv, ciphertext);
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
