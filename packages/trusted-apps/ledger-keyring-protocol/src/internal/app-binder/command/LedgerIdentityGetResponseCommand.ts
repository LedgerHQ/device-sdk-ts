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

const CLA = 0xe0;
const INS_GET_RESPONSE = 0xc0;

export type LedgerIdentityGetResponseCommandResponse = {
  readonly moreFlag: number;
  readonly data: Uint8Array;
};

export type LedgerIdentityGetResponseCommandArgs = undefined;

export class LedgerIdentityGetResponseCommand
  implements
    Command<
      LedgerIdentityGetResponseCommandResponse,
      LedgerIdentityGetResponseCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  readonly name = "ledgerIdentityGetResponse";
  private readonly errorHelper = new CommandErrorHelper<
    LedgerIdentityGetResponseCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS_GET_RESPONSE,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    LedgerIdentityGetResponseCommandResponse,
    LedgerKeyringProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      const moreFlag = parser.extract8BitUInt();
      if (moreFlag === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Missing moreFlag in response"),
        });
      }
      const remaining = parser.getUnparsedRemainingLength();
      const data = remaining > 0
        ? parser.extractFieldByLength(remaining)
        : new Uint8Array(0);

      return CommandResultFactory({
        data: {
          moreFlag,
          data: data ?? new Uint8Array(0),
        },
      });
    });
  }
}
