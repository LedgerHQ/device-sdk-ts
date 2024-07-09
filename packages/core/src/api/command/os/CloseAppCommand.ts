import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";

/**
 * The command to close a runnint application on the device.
 */
export class CloseAppCommand implements Command<void> {
  args = undefined;

  readonly triggersDisconnection = true;

  getApdu(): Apdu {
    const closeAppApduArgs: ApduBuilderArgs = {
      cla: 0xb0,
      ins: 0xa7,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(closeAppApduArgs).build();
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
