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

import { GeneralTags } from "@internal/models/Tags";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyRingProtocolErrorCodes,
  LedgerKeyRingProtocolErrorFactory,
} from "./utils/ledgerKeyRingProtocolErrors";

export interface SignBlockHeaderCommandArgs {
  parent: Uint8Array;
  commandCount: number;
}

export type SignBlockHeaderCommandResponse = Uint8Array;

const ISSUER_PLACEHOLDER = [
  3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
];
export const ISSUER_PLACEHOLDER_TLV = Uint8Array.from([
  GeneralTags.PublicKey,
  ISSUER_PLACEHOLDER.length,
  ...ISSUER_PLACEHOLDER,
]);

export class SignBlockHeaderCommand
  implements
    Command<
      SignBlockHeaderCommandResponse,
      SignBlockHeaderCommandArgs,
      LedgerKeyRingProtocolErrorCodes
    >
{
  readonly name = "signBlockHeader";
  private readonly errorHelper = new CommandErrorHelper<
    SignBlockHeaderCommandResponse,
    LedgerKeyRingProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyRingProtocolErrorFactory);

  constructor(private readonly args: SignBlockHeaderCommandArgs) {}

  getApdu(): Apdu {
    const { parent, commandCount } = this.args;
    const parentTlv = Uint8Array.from([
      GeneralTags.Hash,
      parent.length,
      ...parent,
    ]);

    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x07,
      p1: 0x00,
      p2: 0x00,
    })
      .addBufferToData(Uint8Array.from([GeneralTags.Int, 1, 1])) // Version 1
      .addBufferToData(Uint8Array.from(parentTlv)) // Parent block hash
      .addBufferToData(ISSUER_PLACEHOLDER_TLV) // Placeholder for issuer public key (will be replaced by the device)
      .addBufferToData(Uint8Array.from([GeneralTags.Int, 1, commandCount])) // Command count
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    SignBlockHeaderCommandResponse,
    LedgerKeyRingProtocolErrorCodes
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
            "No data returned by SignBlockHeaderCommand",
          ),
        });
      }
      return CommandResultFactory({ data: payload });
    });
  }
}
