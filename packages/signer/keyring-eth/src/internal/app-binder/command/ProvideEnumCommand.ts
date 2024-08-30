// https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#provide-enum
import {
  Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduResponse,
  type Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";

export type ProvideEnumCommandArgs = {
  /**
   * The enum data to provide in chunks
   */
  readonly payload: Uint8Array;
  /**
   * If this is the first chunk of the message
   */
  readonly isFirstChunk: boolean;
};

export class ProvideEnumCommand
  implements Command<void, ProvideEnumCommandArgs>
{
  constructor(private readonly args: ProvideEnumCommandArgs) {}

  getApdu(): Apdu {
    const ProvideEnumArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x99, // FIXME: TBD
      p1: this.args.isFirstChunk ? 0x01 : 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(ProvideEnumArgs)
      .addBufferToData(this.args.payload)
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