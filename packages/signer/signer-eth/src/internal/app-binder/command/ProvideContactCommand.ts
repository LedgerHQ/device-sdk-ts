// Wire reference:
// ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   prepare_provide_contact → CLA=0xB0, INS=0x10, P1=0x20 (SUB_CMD_PROVIDE_CONTACT).
// Caller (SendProvideContactTask + sendFramedContactsPayload) assembles the TLV
// payload, prepends the 2-byte BE total length, and slices into ≤255B chunks;
// this command frames a single chunk. The device replies with SW=0x9000 and an
// empty data body on success (both intermediate and final chunks) — the value
// is the side-effect (device caches the friendly name for the next Sign review),
// not a returned field. NOT an UPGRADE POINT: provide-decorations stay ETH-app-
// scoped because the payload carries an ETH-app-issued HMAC chain.
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

export type ProvideContactCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type ProvideContactCommandResponse = Record<string, never>;

const PROVIDE_CONTACT_CLA = 0xb0;
const PROVIDE_CONTACT_INS = 0x10;
const PROVIDE_CONTACT_P1 = 0x20;

export class ProvideContactCommand
  implements
    Command<
      ProvideContactCommandResponse,
      ProvideContactCommandArgs,
      EthErrorCodes
    >
{
  readonly name = "provideContact";
  readonly args: ProvideContactCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    ProvideContactCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(args: ProvideContactCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: PROVIDE_CONTACT_CLA,
      ins: PROVIDE_CONTACT_INS,
      p1: PROVIDE_CONTACT_P1,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ProvideContactCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory<ProvideContactCommandResponse, EthErrorCodes>({
        data: {},
      }),
    );
  }
}
