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

import {
  PCZT_INS,
  PCZT_P1,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { SIGHASH_ALL } from "@internal/app-binder/task/utils/legacyTransactionUtils";

export type SignPcztTransparentCommandArgs = {
  /** Transparent input index to sign (carried in P2). */
  inputIndex: number;
};

export type SignPcztTransparentCommandResponse = {
  /**
   * Raw device response: DER-encoded secp256k1 signature followed by a single
   * `sighash_type` byte (`SIGHASH_ALL` = `0x01`).
   */
  signature: Uint8Array;
};

/**
 * `PCZT_SIGN_TRANSPARENT` (`INS 0x55`, P2 = input index, empty data).
 *
 * Accepted only after the PCZT bundle is finalized; each input index is
 * signable once. Returns DER secp256k1 signature + `sighash_type` byte.
 */
export class SignPcztTransparentCommand
  implements
    Command<
      SignPcztTransparentCommandResponse,
      SignPcztTransparentCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "SignPcztTransparent";

  private readonly errorHelper = new CommandErrorHelper<
    SignPcztTransparentCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(private readonly args: SignPcztTransparentCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: PCZT_INS.SIGN_TRANSPARENT,
      p1: PCZT_P1.FIRST,
      p2: this.args.inputIndex,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignPcztTransparentCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const signature = new Uint8Array(apduResponse.data);
      // DER signature (≥1 byte) + trailing sighash_type byte.
      if (signature.length < 2) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected a transparent signature with a trailing sighash byte, got ${signature.length} bytes`,
          ),
        });
      }
      if (signature[signature.length - 1] !== SIGHASH_ALL) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected sighash_type SIGHASH_ALL (0x01), got 0x${signature[
              signature.length - 1
            ]!.toString(16)}`,
          ),
        });
      }
      return CommandResultFactory({ data: { signature } });
    });
  }
}
