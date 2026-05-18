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
  INS,
  P2,
  ZCASH_CLA,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  ZCASH_APP_ERRORS,
  ZcashAppCommandErrorFactory,
  type ZcashErrorCodes,
} from "./utils/zcashApplicationErrors";

export type ZcashSaplingOutputCommitCommandArgs = {
  lockTime: number;
  sigHashType: number;
  expiryHeight?: Uint8Array;
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
    const lockTimeLe = Buffer.alloc(4);
    lockTimeLe.writeUInt32LE(lockTime, 0);
    const expiryLe =
      expiryHeight !== undefined && expiryHeight.byteLength > 0
        ? Buffer.from(expiryHeight)
        : Buffer.alloc(4, 0);
    const payload = Buffer.concat([
      lockTimeLe,
      Buffer.from([0x00, 0x00]),
      Buffer.from([sigHashType & 0xff]),
      expiryLe.subarray(0, 4),
    ]);
    if (payload.length !== 11) {
      throw new Error("ZcashSaplingOutputCommit: internal payload length");
    }

    const apduArgs: ApduBuilderArgs = {
      cla: ZCASH_CLA,
      ins: INS.SIGN_TRANSACTION,
      p1: 0x00,
      p2: P2.DEFAULT,
    };
    return new ApduBuilder(apduArgs)
      .addBufferToData(new Uint8Array(payload))
      .build();
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
