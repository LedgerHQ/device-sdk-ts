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

      const pubKeyHeader = parser.extractFieldByLength(0x04);
      if (!pubKeyHeader) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Pub key header is missing`),
        });
      }

      const pubKey = parser.extractFieldByLength(0x21);

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

      const attestationId = parser.extractFieldByLength(0x01);

      if (!attestationId) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Attestation id is missing`),
        });
      }

      const attestationHeader = parser.extractFieldByLength(0x04);

      if (!attestationHeader) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Attestation header is missing`),
        });
      }
      const attestationKey = parser.extractFieldByLength(0x21);

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
          pubKeySig,
          attestationId,
          attestationHeader,
          attestationKey,
          attestationSig,
        },
      });
    });
  }
}
