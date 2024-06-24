import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";

export type OpenAppArgs = {
  appName: string;
};

/**
 * The command to open an application on the device.
 */
export class OpenAppCommand implements Command<void, OpenAppArgs> {
  args: OpenAppArgs;

  constructor(args: OpenAppArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const openAppApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0xd8,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(openAppApduArgs)
      .addAsciiStringToData(this.args.appName)
      .build();
  }

  parseResponse(apduResponse: ApduResponse): void {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          apduResponse.statusCode,
        )}`,
      );
    }
  }
}
