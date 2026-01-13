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

export interface SignBlockSingleCommandArgs {
  command: Uint8Array;
}

export type SignBlockSingleCommandResponse = Uint8Array;

export class SignBlockSingleCommand
  implements
    Command<
      SignBlockSingleCommandResponse,
      SignBlockSingleCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  readonly name = "signBlockSingle";
  private readonly errorHelper = new CommandErrorHelper<
    SignBlockSingleCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  constructor(private readonly args: SignBlockSingleCommandArgs) {}

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x07,
      p1: 0x01,
      p2: 0x00,
    })
      .addBufferToData(this.args.command)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    SignBlockSingleCommandResponse,
    LedgerKeyringProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      const remaining = parser.getUnparsedRemainingLength();
      const tlvBlob = parser.extractFieldByLength(remaining);
      if (!tlvBlob) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "No data returned by SignBlockSingleCommand",
          ),
        });
      }
      return CommandResultFactory({ data: tlvBlob });
    });
  }
}
