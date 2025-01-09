// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-trusted-name
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

export type ProvideWeb3CheckCommandArgs = {
  payload: string;
  certificate?: boolean;
};

/**
 * The command that provides a chunk of the trusted name to the device.
 */
export class ProvideWeb3CheckCommand
  implements Command<void, ProvideWeb3CheckCommandArgs>
{
  constructor(private readonly args: ProvideWeb3CheckCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x32,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduBuilderArgs)
      .addHexaStringToData(this.args.payload)
      .build();
  }

  parseResponse(response: ApduResponse): CommandResult<void> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }
    return CommandResultFactory({
      data: undefined,
    });
  }
}
