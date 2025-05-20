// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-transaction
// https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#sign (to be removed when the top link has been updated)
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
/**
 * StoreTransactionCommand is a SignTransactionCommand that is used to initiate
 * the sign transaction flow. It signature differs from the SignTransactionCommand
 * because the command does not return any data.
 */
export class StoreTransactionCommand
  implements Command<void, ChunkableCommandArgs, EthErrorCodes>
{
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(readonly args: ChunkableCommandArgs) {}

  getApdu(): Apdu {
    const { chunkedData, isFirstChunk } = this.args;

    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x01,
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    return builder.addBufferToData(chunkedData).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
