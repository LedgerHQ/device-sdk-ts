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
  type SignBlockSignatureCommandArgs,
  type SignBlockSignatureCommandResponse,
} from "@api/app-binder/SignBlockSignatureCommandTypes";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export class SignBlockSignatureCommand
  implements
    Command<
      SignBlockSignatureCommandResponse,
      SignBlockSignatureCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    SignBlockSignatureCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  constructor() {}

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x07,
      p1: 0x02,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    SignBlockSignatureCommandResponse,
    LedgerKeyringProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      const rem = parser.getUnparsedRemainingLength();
      const data = parser.extractFieldByLength(rem);
      if (!data) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "No data returned by SignBlockSignatureCommand",
          ),
        });
      }

      if (data.length < 2) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Invalid response: missing signature length or reserved byte",
          ),
        });
      }

      const raw = data[0];
      if (raw === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Invalid response: unable to read signature length",
          ),
        });
      }

      const sigLen = raw;
      if (data.length < 2 + sigLen) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature length out of bounds"),
        });
      }

      const signature = data.slice(1, 1 + sigLen);
      const deviceSessionKey = data.slice(1 + sigLen + 1);

      return CommandResultFactory({ data: { signature, deviceSessionKey } });
    });
  }
}
