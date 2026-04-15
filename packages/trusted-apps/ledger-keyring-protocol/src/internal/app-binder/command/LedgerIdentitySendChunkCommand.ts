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
const P2_MORE = 0x80;
const P2_LAST = 0x00;

export type LedgerIdentitySendChunkCommandResponse = {
  readonly moreFlag: number;
  readonly data: Uint8Array;
};

export type LedgerIdentitySendChunkCommandArgs = {
  readonly ins: number;
  readonly chunkIndex: number;
  readonly isLast: boolean;
  readonly data: Uint8Array;
};

export class LedgerIdentitySendChunkCommand
  implements
    Command<
      LedgerIdentitySendChunkCommandResponse,
      LedgerIdentitySendChunkCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  readonly name = "ledgerIdentitySendChunk";
  constructor(private readonly args: LedgerIdentitySendChunkCommandArgs) {}

  private readonly errorHelper = new CommandErrorHelper<
    LedgerIdentitySendChunkCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  getApdu(): Apdu {
    const { ins, chunkIndex, isLast, data } = this.args;
    return new ApduBuilder({
      cla: CLA,
      ins,
      p1: chunkIndex,
      p2: isLast ? P2_LAST : P2_MORE,
    })
      .addBufferToData(data)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    LedgerIdentitySendChunkCommandResponse,
    LedgerKeyringProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      if (parser.getUnparsedRemainingLength() === 0) {
        return CommandResultFactory({
          data: {
            moreFlag: 0x00,
            data: new Uint8Array(0),
          },
        });
      }

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
