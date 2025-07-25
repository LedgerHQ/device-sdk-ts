import {
  ByteArrayParser,
  UnknownDAError,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Maybe } from "purify-ts";

import { LKRPMissingDataError } from "@api/app-binder/Errors";
import { type Keypair } from "@api/app-binder/LKRPTypes";
import {
  type AuthenticationPayload,
  type Challenge,
} from "@internal/lkrp-datasource/data/LKRPDataSource";
import { CryptoUtils } from "@internal/utils/crypto";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { bytesToHex, hexToBytes } from "@internal/utils/hex";

export class SignChallengeWithKeypairTask {
  constructor(
    private readonly keypair: Keypair,
    private readonly trustchainId: string,
  ) {}

  run(
    challenge: Challenge,
  ): EitherAsync<LKRPMissingDataError | UnknownDAError, AuthenticationPayload> {
    const attestation = this.getAttestation();
    const credential = this.getCredential(this.keypair.publicKey);

    return EitherAsync.liftEither(this.getUnsignedChallengeTLV(challenge.tlv))
      .map(CryptoUtils.hash)
      .map((hash) => CryptoUtils.sign(hash, this.keypair.privateKey))
      .map(bytesToHex)
      .map((signature) => ({
        challenge: challenge.json,
        signature: { attestation, credential, signature },
      }))
      .mapLeft((error) =>
        error instanceof LKRPMissingDataError
          ? error
          : new UnknownDAError(String(error)),
      );
  }

  // Spec https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4335960138/ARCH+LedgerLive+Auth+specifications
  private getAttestation() {
    const bytes = new TextEncoder().encode(this.trustchainId);
    const attestation = Uint8Array.from([0x02, bytes.length, ...bytes]);
    return bytesToHex(attestation);
  }

  private getCredential(pubKeyBytes: Uint8Array) {
    const publicKey = bytesToHex(pubKeyBytes);
    return { version: 0, curveId: 33, signAlgorithm: 1, publicKey };
  }

  private getUnsignedChallengeTLV(
    tlv: string,
  ): Either<LKRPMissingDataError, Uint8Array> {
    const parser = new ByteArrayParser(hexToBytes(tlv));
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
