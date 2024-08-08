import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { InvalidResponseFormatError } from "@api/command/Errors";
import {
  CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import {
  GlobalCommandErrorHandler,
  GlobalCommandErrorStatusCode,
} from "@api/command/utils/GlobalCommandError";
import { ApduResponse } from "@api/device-session/ApduResponse";

export type GetAppAndVersionResponse = {
  /**
   * The name of the application currently running on the device.
   */
  readonly name: string;
  /**
   * The version of the application currently running on the device.
   */
  readonly version: string;
  readonly flags?: number | Uint8Array;
};

/**
 * Command to get information about the application currently running on the
 * device.
 */
export class GetAppAndVersionCommand
  implements Command<GetAppAndVersionResponse, GlobalCommandErrorStatusCode>
{
  readonly args = undefined;

  getApdu(): Apdu {
    const getAppAndVersionApduArgs: ApduBuilderArgs = {
      cla: 0xb0,
      ins: 0x01,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(getAppAndVersionApduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppAndVersionResponse, GlobalCommandErrorStatusCode> {
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }
    const parser = new ApduParser(apduResponse);

    if (parser.extract8BitUInt() !== 1) {
      return CommandResultFactory({
        error: new InvalidResponseFormatError(
          "getAppAndVersion: format not supported",
        ),
      });
    }

    const name = parser.encodeToString(parser.extractFieldLVEncoded());
    const version = parser.encodeToString(parser.extractFieldLVEncoded());

    if (parser.getUnparsedRemainingLength() === 0) {
      return CommandResultFactory({
        data: { name, version },
      });
    }

    const flags = parser.extractFieldLVEncoded();
    return CommandResultFactory({
      data: { name, version, flags },
    });
  }
}
