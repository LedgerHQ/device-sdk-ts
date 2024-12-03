import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";

import {
  type GetVersionCommandArgs,
  type GetVersionCommandResponse,
} from "@api/app-binder/GetVersionCommandTypes";

export class GetVersionCommand
  implements Command<GetVersionCommandResponse, GetVersionCommandArgs>
{
  args: GetVersionCommandArgs;

  constructor(args: GetVersionCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getNearVersionArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x06,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getNearVersionArgs);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetVersionCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    const major = parser.extract8BitUInt();
    const minor = parser.extract8BitUInt();
    const patch = parser.extract8BitUInt();

    return CommandResultFactory({
      data: { version: `${major}.${minor}.${patch}` },
    });
  }
}
