import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { Command } from "@api/command/Command";
import { GlobalErrorHandler } from "@api/command/Errors";
import {
  CommandResult,
  CommandResultFactory,
  CommandResultStatus,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { GlobalCommandErrorStatusCode } from "@api/Error";

/**
 * The command to close a runnint application on the device.
 */
export class CloseAppCommand implements Command<void> {
  readonly args = undefined;

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

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, GlobalCommandErrorStatusCode> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: void 0,
        status: CommandResultStatus.Success,
      });
    }
    return CommandResultFactory({
      status: CommandResultStatus.Error,
      error: GlobalErrorHandler.handle(apduResponse),
    });
  }
}
