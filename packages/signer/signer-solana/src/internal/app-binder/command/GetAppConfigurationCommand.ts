import {
  Apdu,
  ApduBuilder,
  ApduParser,
  ApduResponse,
  Command,
  CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

type GetAppConfigurationCommandResponse = {
  blindSigningEnabled: boolean;
  pubKeyDisplayMode: boolean;
  version: string;
};

type GetAppConfigurationCommandArgs = void;

export class GetAppConfigurationCommand
  implements
    Command<GetAppConfigurationCommandResponse, GetAppConfigurationCommandArgs>
{
  args: GetAppConfigurationCommandArgs;

  constructor(args: GetAppConfigurationCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x04,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAppConfigurationCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    const buffer = parser.extractFieldByLength(5);

    if (
      !buffer ||
      buffer.length !== 5 ||
      buffer.some((element) => element === undefined)
    ) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid response"),
      });
    }

    return CommandResultFactory({
      data: {
        blindSigningEnabled: Boolean(buffer[0]),
        pubKeyDisplayMode: Boolean(buffer[1]),
        version: `${buffer[2]}.${buffer[3]}.${buffer[4]}`,
      },
    });
  }
}
