import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
} from "@ledgerhq/device-management-kit";

import {
  type GetVersionCommandArgs,
  type GetVersionCommandResponse,
} from "@api/app-binder/GetVersionCommandTypes";
import {
  NearAppCommand,
  type NearAppErrorCodes,
} from "@internal/app-binder/command/NearAppCommand";

export class GetVersionCommand extends NearAppCommand<
  GetVersionCommandResponse,
  GetVersionCommandArgs
> {
  args: GetVersionCommandArgs;

  constructor(args: GetVersionCommandArgs) {
    super();
    this.args = args;
  }

  override getApdu(): Apdu {
    const getNearVersionArgs: ApduBuilderArgs = {
      cla: 0x80,
      ins: 0x06,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getNearVersionArgs);

    return builder.build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<GetVersionCommandResponse, NearAppErrorCodes> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return this._getError(response, parser);
    }

    const major = parser.extract8BitUInt();
    const minor = parser.extract8BitUInt();
    const patch = parser.extract8BitUInt();

    return CommandResultFactory({
      data: { version: `${major}.${minor}.${patch}` },
    });
  }
}
