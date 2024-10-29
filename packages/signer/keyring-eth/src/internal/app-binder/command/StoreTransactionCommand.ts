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
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";

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
  implements Command<void, StoreTransactionCommandArgs>
{
  constructor(private readonly args: StoreTransactionCommandArgs) {}

  getApdu(): Apdu {
    const { serializedTransaction, isFirstChunk } = this.args;

    const signEthTransactionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x04,
      p1: isFirstChunk ? 0x01 : 0x00,
      p2: 0x02,
    };
    const builder = new ApduBuilder(signEthTransactionArgs);
    return builder.addBufferToData(serializedTransaction).build();
  }

  parseResponse(response: ApduResponse): CommandResult<void> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    return CommandResultFactory({ data: undefined });
  }
}
