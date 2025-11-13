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

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type StoreTransactionCommandArgs = {
  /**
   * The transaction to sign in max 150 bytes chunks
   */
  readonly serializedTransaction: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
};

/**
 * StoreTransactionCommand is a SignTransactionCommand that is used to initiate
 * the sign transaction flow. It signature differs from the SignTransactionCommand
 * because the command does not return any data.
 */
export class StoreTransactionCommand
  implements Command<void, StoreTransactionCommandArgs, EthErrorCodes>
{
  readonly name = "storeTransaction";
  private readonly errorHelper = new CommandErrorHelper<void, EthErrorCodes>(
    ETH_APP_ERRORS,
    EthAppCommandErrorFactory,
  );

  constructor(private readonly args: StoreTransactionCommandArgs) {}

  getApdu(): Apdu {
    const { serializedTransaction, isFirstChunk } = this.args;

    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: isFirstChunk ? 0x00 : 0x80,
      p2: 0x01,
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    return builder.addBufferToData(serializedTransaction).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void, EthErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefault(
      CommandResultFactory({ data: undefined }),
    );
  }
}
