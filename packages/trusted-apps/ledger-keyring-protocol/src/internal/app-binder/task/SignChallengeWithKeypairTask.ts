import {
  bufferToHexaString,
  ByteArrayParser,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Maybe } from "purify-ts";

import { type CryptoService, HashAlgo } from "@api/crypto/CryptoService";
import { type KeyPair, SigFormat } from "@api/crypto/KeyPair";
import { LKRPMissingDataError, LKRPUnknownError } from "@api/model/Errors";
import {
  type AuthenticationPayload,
  type Challenge,
} from "@internal/lkrp-datasource/data/LKRPDataSource";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

export class SignChallengeWithKeypairTask {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly keyPair: KeyPair,
    private readonly trustchainId: string,
  ) {}

  run(
    challenge: Challenge,
  ): EitherAsync<
    LKRPMissingDataError | LKRPUnknownError,
    AuthenticationPayload
  > {
    const attestation = this.getAttestation();
    const credential = this.getCredential(this.keyPair.getPublicKeyToHex());

    return EitherAsync.liftEither(this.getUnsignedChallengeTLV(challenge.tlv))
      .map((buf) => this.cryptoService.hash(buf, HashAlgo.SHA256))
      .map((hash) => this.keyPair.sign(hash, SigFormat.DER))
      .map((str) => bufferToHexaString(str, false))
      .map((signature) => ({
        challenge: challenge.json,
        signature: { attestation, credential, signature },
      }))
      .mapLeft((error) =>
        error instanceof LKRPMissingDataError
          ? error
          : new LKRPUnknownError(String(error)),
      );
  }

  // Spec https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4335960138/ARCH+LedgerLive+Auth+specifications
  private getAttestation() {
    const bytes = new TextEncoder().encode(this.trustchainId);
    const attestation = Uint8Array.from([0x02, bytes.length, ...bytes]);
    return bufferToHexaString(attestation, false);
  }

  private getCredential(publicKey: string) {
    return { version: 0, curveId: 33, signAlgorithm: 1, publicKey };
  }

  private getUnsignedChallengeTLV(
    tlv: string,
  ): Either<LKRPMissingDataError, Uint8Array> {
    const parser = new ByteArrayParser(
      hexaStringToBuffer(tlv) ?? new Uint8Array(),
    );
    const parsed = new Map(
      (function* () {
        while (true) {
          const field = parser.extractFieldTLVEncoded();
          if (!field) break; // No more fields to extract
          yield [field.tag, field.value];
        }
      })(),
    );

    // We expect 10 fields in the TLV
    if (parsed.size > 10) {
      return Left(
        new LKRPMissingDataError("Challenge TLV contains unexpected data"),
      );
    }

    const getField = (tag: number, fieldName: string) =>
      Maybe.fromNullable(parsed.get(tag)).toEither(
        new LKRPMissingDataError(`Missing ${fieldName} field`),
      );

    return eitherSeqRecord({
      // Unsigned fields
      payloadType: () => getField(0x01, "Payload type"),
      version: () => getField(0x02, "Version"),
      challengeExpiry: () => getField(0x16, "Challenge expiry"),
      host: () => getField(0x20, "Host"),
      protocolVersion: () => getField(0x60, "Protocol version"),

      // Signed fields
      curveId: () => getField(0x32, "Curve ID"),
      publicKey: () => getField(0x33, "Public key"),
      challengeData: () => getField(0x12, "Challenge data"),
      signAlgorithm: () => getField(0x14, "Sign algorithm"),
      rpSignatureField: () => getField(0x15, "RP signature field"),
    }).map((fields) =>
      Uint8Array.from(
        [
          [0x01, fields.payloadType.length, ...fields.payloadType],
          [0x02, fields.version.length, ...fields.version],
          [0x12, fields.challengeData.length, ...fields.challengeData],
          [0x16, fields.challengeExpiry.length, ...fields.challengeExpiry],
          [0x20, fields.host.length, ...fields.host],
          [0x60, fields.protocolVersion.length, ...fields.protocolVersion],
        ].flat(),
      ),
    );
  }
}
