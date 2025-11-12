import {
  type Apdu,
  ApduBuilder,
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
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export type ParseSingleCommandArgs = {
  command: Uint8Array;
  outputTrustedParam?: boolean;
};

export type ParseSingleCommandResponse = Uint8Array;

export class ParseSingleCommand
  implements
    Command<
      ParseSingleCommandResponse,
      ParseSingleCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  readonly name = "parseSingle";
  private readonly errorHelper = new CommandErrorHelper<
    ParseSingleCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  constructor(private readonly args: ParseSingleCommandArgs) {}

  getApdu(): Apdu {
    const { command, outputTrustedParam = true } = this.args;
    return (
      new ApduBuilder({
        cla: 0xe0,
        ins: 0x08,
        p1: 0x01,
        p2: outputTrustedParam ? 0x01 : 0x00,
      })
        // raw command chunk
        .addBufferToData(command)
        .build()
    );
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    ParseSingleCommandResponse,
    LedgerKeyringProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      const remaining = parser.getUnparsedRemainingLength();
      const payload = parser.extractFieldByLength(remaining);
      if (!payload) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "No data returned by ParseSingleCommand",
          ),
        });
      }
      return CommandResultFactory({ data: payload });
    });
  }
}
