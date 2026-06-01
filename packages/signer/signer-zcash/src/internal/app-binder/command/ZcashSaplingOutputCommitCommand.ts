import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";
import { uint32ToBytesLE } from "@internal/utils/numberToBytes";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

const SIGN_TRANSACTION = 0x48;

export type ZcashSaplingOutputCommitCommandArgs = {
  lockTime: number;
  sigHashType: number;
  expiryHeight: Uint8Array;
};

export type ZcashSaplingOutputCommitCommandResponse = {
  readonly committed: true;
};

/**
 * After `HASH_OUTPUT_FULL`, Zcash + Sapling requires this short `SIGN` (`0x48`)
 * before the second `START_UNTRUSTED_HASH` pass
 */
export class ZcashSaplingOutputCommitCommand
  implements
    Command<
      ZcashSaplingOutputCommitCommandResponse,
      ZcashSaplingOutputCommitCommandArgs,
      ZcashErrorCodes
    >
{
  readonly name = "ZcashSaplingOutputCommit";

  private readonly errorHelper = new CommandErrorHelper<
    ZcashSaplingOutputCommitCommandResponse,
    ZcashErrorCodes
  >(ZCASH_APP_ERRORS, ZcashAppCommandErrorFactory);

  constructor(private readonly args: ZcashSaplingOutputCommitCommandArgs) {}

  getApdu(): Apdu {
    const { lockTime, sigHashType, expiryHeight } = this.args;
    const payload = concatUint8Arrays(
      uint32ToBytesLE(lockTime),
      Uint8Array.of(0x00, 0x00),
      Uint8Array.of(sigHashType & 0xff),
      expiryHeight,
    );
    if (payload.length !== 11) {
      throw new Error("ZcashSaplingOutputCommit: internal payload length");
    }

    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: SIGN_TRANSACTION,
      p1: 0x00,
      p2: P2.DEFAULT,
    };
    return new ApduBuilder(apduArgs).addBufferToData(payload).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ZcashSaplingOutputCommitCommandResponse, ZcashErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({
        data: { committed: true },
      }),
    );
  }
}
