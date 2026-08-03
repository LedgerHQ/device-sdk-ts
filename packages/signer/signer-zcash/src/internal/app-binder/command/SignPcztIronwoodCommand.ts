import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type IronwoodActionSignature } from "@api/model/PcztSignature";
import {
  PCZT_P1,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";

/**
 * `INS_PCZT_SIGN_IRONWOOD`: signs one Ironwood action. P2 = action index;
 * returns `spendAuthSig[64]`. Mirrors `LedgerHQ/app-zcash` `src/consts.rs`.
 */
export const INS_PCZT_SIGN_IRONWOOD = 0x59;

/** RedPallas spend-authorization signature length. */
const SPEND_AUTH_SIG_LENGTH = 64;

export type SignPcztIronwoodCommandArgs = {
  /** Ironwood action index to sign (carried in P2). */
  actionIndex: number;
};

/**
 * `PCZT_SIGN_IRONWOOD` (`INS 0x59`, P2 = action index, empty data).
 *
 * Accepted only after the PCZT bundle is finalized; each action index is
 * signable once. Returns the RedPallas `spendAuthSig[64]` only — `alpha` is a
 * host-supplied PCZT field and is never returned.
 */
export class SignPcztIronwoodCommand
  implements
    Command<
      IronwoodActionSignature,
      SignPcztIronwoodCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "SignPcztIronwood";

  private readonly errorHelper = new CommandErrorHelper<
    IronwoodActionSignature,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(private readonly args: SignPcztIronwoodCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS_PCZT_SIGN_IRONWOOD,
      p1: PCZT_P1.FIRST,
      p2: this.args.actionIndex,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<IronwoodActionSignature, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const spendAuthSig = new Uint8Array(apduResponse.data);
      if (spendAuthSig.length !== SPEND_AUTH_SIG_LENGTH) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected ${SPEND_AUTH_SIG_LENGTH}-byte Ironwood spendAuthSig, got ${spendAuthSig.length}`,
          ),
        });
      }
      return CommandResultFactory({ data: { spendAuthSig } });
    });
  }
}
