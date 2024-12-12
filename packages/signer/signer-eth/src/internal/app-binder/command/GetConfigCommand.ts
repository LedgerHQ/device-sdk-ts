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
import { InvalidResponseFormatError } from "@ledgerhq/device-management-kit/src/api/command/Errors.js";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";

export class GetConfigCommand
  implements Command<GetConfigCommandResponse, void>
{
  constructor() {}

  getApdu(): Apdu {
    const getEthConfigArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x06,
      p1: 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getEthConfigArgs);
    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetConfigCommandResponse> {
    const parser = new ApduParser(response);

    if (!CommandUtils.isSuccessResponse(response)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    const configFlags = parser.extract8BitUInt();
    if (configFlags === undefined) {
      return CommandResultFactory({
        error: new InvalidResponseFormatError("Cannot extract config flags."),
      });
    }

    const isBlindSigningEnabled = !!(configFlags & 0x00000001);
    const isWeb3ChecksEnabled = !!(configFlags & 0x00000010);

    return CommandResultFactory({
      data: {
        blindSigningEnabled: isBlindSigningEnabled,
        web3ChecksEnabled: isWeb3ChecksEnabled,
      },
    });
  }
}
