import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
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

import {
  LEDGER_SYNC_ERRORS,
  type LedgerSyncErrorCodes,
  LedgerSyncErrorFactory,
} from "./utils/ledgerSyncErrors";

export class GetSeedIdCommand
  implements
    Command<
      GetSeedIdCommandResponse,
      GetSeedIdCommandArgs,
      LedgerSyncErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    GetSeedIdCommandResponse,
    LedgerSyncErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerSyncErrorFactory);

  constructor(private readonly args: GetSeedIdCommandArgs) {}
  getApdu(): Apdu {
    // NOTE: Do we want to get every single field here?
    // Or should we just get an already formatted Uint8Array?
    const {
      structureType,
      version,
      challenge,
      signerAlgo,
      derSignature,
      validUntil,
      trustedName,
      pubKeyCurve,
      pubKey,
      protocolVersion,
    } = this.args;
    const getSeedIdArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x03,
      p1: 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(getSeedIdArgs);
    builder.add8BitUIntToData(structureType);
    builder.add8BitUIntToData(version);
    builder.addHexaStringToData(challenge);
    builder.add8BitUIntToData(signerAlgo);
    builder.addHexaStringToData(derSignature);
    builder.addHexaStringToData(validUntil);
    builder.addHexaStringToData(trustedName);
    builder.add8BitUIntToData(pubKeyCurve);
    builder.addHexaStringToData(pubKey);
    builder.add32BitUIntToData(protocolVersion);

    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetSeedIdCommandResponse, LedgerSyncErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const pubKeyHeader = parser.extract32BitUInt();
      if (!pubKeyHeader) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Pub key header is missing`),
        });
      }

      const pubKey = parser.extractFieldByLength(21);

      if (!pubKey) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Pub key is missing`),
        });
      }

      const pubKeySigLength = parser.extract8BitUInt();

      if (!pubKeySigLength) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Pub key sig length is missing`),
        });
      }

      const pubKeySig = parser.extractFieldByLength(pubKeySigLength);

      if (!pubKeySig) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Pub key sig is missing`),
        });
      }

      const attestationId = parser.extract8BitUInt();

      if (!attestationId) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Attestation id is missing`),
        });
      }

      const attestationHeader = parser.extract32BitUInt();

      if (!attestationHeader) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Attestation header is missing`),
        });
      }
      const attestationKey = parser.extractFieldByLength(21);

      if (!attestationKey) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Attestation key is missing`),
        });
      }

      const attestationSigLength = parser.extract8BitUInt();
      if (!attestationSigLength) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Attestation sig length is missing`,
          ),
        });
      }
      const attestationSig = parser.extractFieldByLength(attestationSigLength);

      if (!attestationSig) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Attestation sig is missing`),
        });
      }

      return CommandResultFactory({
        data: {
          pubKeyHeader,
          pubKey,
          pubKeySigLength,
          pubKeySig,
          attestationId,
          attestationHeader,
          attestationKey,
          attestationSigLength,
          attestationSig,
        },
      });
    });
  }
}
