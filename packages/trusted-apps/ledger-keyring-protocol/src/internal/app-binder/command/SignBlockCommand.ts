import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  type SignBlockCommandArgs,
  type SignBlockCommandResponse,
} from "@api/app-binder/SignBlockCommandTypes";

import { extractTrustedProperty } from "./utils/extractTrustedProperty";
import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export class SignBlockCommand
  implements
    Command<
      SignBlockCommandResponse,
      SignBlockCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    SignBlockCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);
  constructor(private readonly args: SignBlockCommandArgs) {}

  getApdu(): Apdu {
    const { p1, payload } = this.args;
    const signCommandArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x07,
      p1,
      p2: 0x00,
    };

    const builder = new ApduBuilder(signCommandArgs);
    builder.addBufferToData(payload);
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignBlockCommandResponse, LedgerKeyringProtocolErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const trustedProperty = extractTrustedProperty(parser);

      return CommandResultFactory({
        data: {
          trustedProperty,
        },
      });
    });
  }
}
