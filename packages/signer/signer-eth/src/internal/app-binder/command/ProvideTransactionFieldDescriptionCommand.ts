//https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#tx-field-description
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

import { type ChunkableCommandArgs } from "@internal/app-binder/task/SendCommandInChunksTask";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export class ProvideTransactionFieldDescriptionCommand
  implements Command<void, ChunkableCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(readonly args: ChunkableCommandArgs) {}

  getApdu(): Apdu {
    const ProvideTransactionFieldDescriptionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x28,
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(ProvideTransactionFieldDescriptionArgs)
      .addBufferToData(this.args.chunkedData)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
