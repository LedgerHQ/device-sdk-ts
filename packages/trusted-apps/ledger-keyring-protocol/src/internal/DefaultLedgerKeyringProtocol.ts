import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import {
  ByteArrayBuilder,
  ByteArrayParser,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";
import { Maybe } from "purify-ts";

import { type AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { LKRPParsingError } from "@api/app-binder/Errors";
import { KeypairFromBytes } from "@api/app-binder/KeypairFromBytes";
import {
  type JWT,
  type Keypair,
  type Permissions,
} from "@api/app-binder/LKRPTypes";
import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { makeContainer } from "@internal/di";
import { AES_BLOCK_SIZE, CryptoUtils } from "@internal/utils/crypto";

import { type AuthenticateUseCase } from "./use-cases/authentication/AuthenticateUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { eitherSeqRecord } from "./utils/eitherSeqRecord";

type DefaultLedgerKeyringProtocolConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  baseUrl: string;
};

export class DefaultLedgerKeyringProtocol implements LedgerKeyringProtocol {
  name: string;
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    baseUrl,
  }: DefaultLedgerKeyringProtocolConstructorArgs) {
    this.name = "Ledger Keyring Protocol";
    this._container = makeContainer({ dmk, sessionId, baseUrl });
  }

  authenticate(
    keypair: Keypair,
    applicationId: number,
    clientName: string,
    permissions: Permissions,
    trustchainId?: string,
    jwt?: JWT,
  ): AuthenticateDAReturnType {
    return this._container
      .get<AuthenticateUseCase>(useCasesTypes.AuthenticateUseCase)
      .execute(
        keypair,
        applicationId,
        clientName,
        permissions,
        trustchainId,
        jwt,
      );
  }

  // TODO Better return type for error management instead of exceptions
  encryptData(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    // TODO move implem in a use case

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

  decryptData(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    // TODO move implem in a use case

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
