import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  bufferToHexaString,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  type GetSeedIdCommandArgs,
  type GetSeedIdCommandResponse,
} from "@api/app-binder/GetSeedIdCommandTypes";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export class GetSeedIdCommand
  implements
    Command<
      GetSeedIdCommandResponse,
      GetSeedIdCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    GetSeedIdCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  constructor(private readonly args: GetSeedIdCommandArgs) {}
  getApdu(): Apdu {
    const { challengeTLV } = this.args;
    const getSeedIdArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x05,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(getSeedIdArgs)
      .addHexaStringToData(challengeTLV)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetSeedIdCommandResponse, LedgerKeyringProtocolErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const required = <T>(value: T | undefined, errorMsg: string) =>
        Maybe.fromNullable(value).toEither(
          new InvalidStatusWordError(errorMsg),
        );

      return eitherSeqRecord({
        credential: () =>
          eitherSeqRecord({
            version: () =>
              required(parser.extract8BitUInt(), "Version is missing"),
            curveId: () =>
              required(parser.extract8BitUInt(), "Curve ID is missing"),
            signAlgorithm: () =>
              required(parser.extract8BitUInt(), "Sign algorithm is missing"),
            publicKey: () =>
              required(parser.extract8BitUInt(), "Public key length is missing")
                .chain((length) =>
                  required(
                    parser.extractFieldByLength(length),
                    "Public key is missing",
                  ),
                )
                .map((str) => bufferToHexaString(str, false)),
          }),

        signature: () =>
          required(parser.extract8BitUInt(), "Signature length is missing")
            .chain((length) =>
              required(
                parser.extractFieldByLength(length),
                "Signature is missing",
              ),
            )
            .map((str) => bufferToHexaString(str, false)),

        attestation: () =>
          eitherSeqRecord({
            id: () =>
              required(
                parser.extractFieldByLength(0x01),
                "Attestation Id is missing",
              ),
            version: () =>
              required(
                parser.extract8BitUInt(),
                "Attestation version is missing",
              ),
            curveId: () =>
              required(
                parser.extract8BitUInt(),
                "Attestation curve ID is missing",
              ),
            signAlgorithm: () =>
              required(
                parser.extract8BitUInt(),
                "Attestation sign algorithm is missing",
              ),
            publicKey: () =>
              required(
                parser.extract8BitUInt(),
                "Attestation key length is missing",
              ).chain((length) =>
                required(
                  parser.extractFieldByLength(length),
                  "Attestation key is missing",
                ),
              ),
            signature: () =>
              required(
                parser.extract8BitUInt(),
                "Attestation signature length is missing",
              ).chain((length) =>
                required(
                  parser.extractFieldByLength(length),
                  "Attestation signature is missing",
                ),
              ),
          }).map((attestation) =>
            bufferToHexaString(
              Uint8Array.from([
                ...attestation.id,
                attestation.version,
                attestation.curveId,
                attestation.signAlgorithm,
                attestation.publicKey.length,
                ...attestation.publicKey,
                attestation.signature.length,
                ...attestation.signature,
              ]),
              false,
            ),
          ),
      }).caseOf({
        Left: (error) => CommandResultFactory({ error }),
        Right: (data) => CommandResultFactory({ data }),
      });
    });
  }
}
