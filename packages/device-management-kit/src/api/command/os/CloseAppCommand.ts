import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { type Command } from "@api/command/Command";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";

export type CloseAppCommandResult = CommandResult<void>;

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

  parseResponse(apduResponse: ApduResponse): CommandResult<void> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }
    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
