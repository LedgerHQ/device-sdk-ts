// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:449-486
//   prepare_provide_ledger_account_contact → CLA=0xB0, INS=0x10, P1=0x21
//   (SUB_CMD_PROVIDE_LEDGER_ACCOUNT_CONTACT).
// Caller (SendProvideLedgerAccountTask + sendFramedContactsPayload) assembles
// the TLV payload, prepends the 2-byte BE total length, and slices into ≤255B
// chunks; this command frames a single chunk. The device derives the address
// from the BIP32 path internally and replies with SW=0x9000 + empty data on
// success. Same op is used for both From-side and To-side decoration when the
// counterparty is a Ledger account.
import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type ProvideLedgerAccountCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type ProvideLedgerAccountCommandResponse = Record<string, never>;

const PROVIDE_LEDGER_ACCOUNT_CLA = 0xb0;
const PROVIDE_LEDGER_ACCOUNT_INS = 0x10;
const PROVIDE_LEDGER_ACCOUNT_P1 = 0x21;

export class ProvideLedgerAccountCommand
  implements
    Command<
      ProvideLedgerAccountCommandResponse,
      ProvideLedgerAccountCommandArgs,
      EthErrorCodes
    >
{
  readonly name = "provideLedgerAccount";
  readonly args: ProvideLedgerAccountCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    ProvideLedgerAccountCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(args: ProvideLedgerAccountCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: PROVIDE_LEDGER_ACCOUNT_CLA,
      ins: PROVIDE_LEDGER_ACCOUNT_INS,
      p1: PROVIDE_LEDGER_ACCOUNT_P1,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ProvideLedgerAccountCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory<ProvideLedgerAccountCommandResponse, EthErrorCodes>({
        data: {},
      }),
    );
  }
}
