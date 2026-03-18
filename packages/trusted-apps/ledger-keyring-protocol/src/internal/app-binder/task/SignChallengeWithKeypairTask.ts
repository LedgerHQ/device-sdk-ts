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

const TAG_ATTESTATION = 0x02;
const EXPECTED_FIELD_COUNT = 10;
const CURVE_ID = 33;
const TAG_PAYLOAD_TYPE = 0x01;
const TAG_VERSION = 0x02;
const TAG_CHALLENGE_DATA = 0x12;
const TAG_SIGN_ALGORITHM = 0x14;
const TAG_RP_SIGNATURE = 0x15;
const TAG_CHALLENGE_EXPIRY = 0x16;
const TAG_HOST = 0x20;
const TAG_CURVE_ID = 0x32;
const TAG_PUBLIC_KEY = 0x33;
const TAG_PROTOCOL_VERSION = 0x60;

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
    const attestation = Uint8Array.from([
      TAG_ATTESTATION,
      bytes.length,
      ...bytes,
    ]);
    return bufferToHexaString(attestation, false);
  }

  private getCredential(publicKey: string) {
    return { version: 0, curveId: CURVE_ID, signAlgorithm: 1, publicKey };
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
    if (parsed.size > EXPECTED_FIELD_COUNT) {
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
      payloadType: () => getField(TAG_PAYLOAD_TYPE, "Payload type"),
      version: () => getField(TAG_VERSION, "Version"),
      challengeExpiry: () => getField(TAG_CHALLENGE_EXPIRY, "Challenge expiry"),
      host: () => getField(TAG_HOST, "Host"),
      protocolVersion: () => getField(TAG_PROTOCOL_VERSION, "Protocol version"),

      // Signed fields
      curveId: () => getField(TAG_CURVE_ID, "Curve ID"),
      publicKey: () => getField(TAG_PUBLIC_KEY, "Public key"),
      challengeData: () => getField(TAG_CHALLENGE_DATA, "Challenge data"),
      signAlgorithm: () => getField(TAG_SIGN_ALGORITHM, "Sign algorithm"),
      rpSignatureField: () => getField(TAG_RP_SIGNATURE, "RP signature field"),
    }).map((fields) =>
      Uint8Array.from(
        [
          [TAG_PAYLOAD_TYPE, fields.payloadType.length, ...fields.payloadType],
          [TAG_VERSION, fields.version.length, ...fields.version],
          [
            TAG_CHALLENGE_DATA,
            fields.challengeData.length,
            ...fields.challengeData,
          ],
          [
            TAG_CHALLENGE_EXPIRY,
            fields.challengeExpiry.length,
            ...fields.challengeExpiry,
          ],
          [TAG_HOST, fields.host.length, ...fields.host],
          [
            TAG_PROTOCOL_VERSION,
            fields.protocolVersion.length,
            ...fields.protocolVersion,
          ],
        ].flat(),
      ),
    );
  }
}
