// https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#transaction-info
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

export type ProvideTransactionInformationCommandArgs = {
  /**
   * The transaction information to provide in chunks
   */
  readonly data: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
};

export class ProvideTransactionInformationCommand
  implements Command<void, ProvideTransactionInformationCommandArgs>
{
  constructor(
    private readonly args: ProvideTransactionInformationCommandArgs,
  ) {}

  getApdu(): Apdu {
    const ProvideTransactionInformationArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x99, // FIXME: TBD
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(ProvideTransactionInformationArgs)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void> {
    if (CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({ data: undefined });
    }

    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(response),
    });
  }
}
