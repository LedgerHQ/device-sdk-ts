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

export type ParseBlockSignatureCommandResponse = Uint8Array;

export type ParseBlockSignatureCommandArgs = { signature: Uint8Array };

export class ParseBlockSignatureCommand
  implements
    Command<
      ParseBlockSignatureCommandResponse,
      ParseBlockSignatureCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    ParseBlockSignatureCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  constructor(private readonly args: ParseBlockSignatureCommandArgs) {}

  getApdu(): Apdu {
    const { signature } = this.args;
    return (
      new ApduBuilder({
        cla: 0xe0,
        ins: 0x08,
        p1: 0x02,
        p2: 0x00,
      })
        // raw signature chunk
        .addBufferToData(signature)
        .build()
    );
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    ParseBlockSignatureCommandResponse,
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
            "No data returned by ParseBlockSignatureCommand",
          ),
        });
      }
      return CommandResultFactory({ data: payload });
    });
  }
}
