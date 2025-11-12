import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import {
  type CommandErrors,
  isCommandErrorCode,
} from "@api/command/utils/CommandErrors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type CommandErrorArgs, DeviceExchangeError } from "@api/Error";

export type GetCustomImageSizeResponse = number;

export type GetCustomImageSizeErrorCodes = "662e" | "662f";

const IMAGE_SIZE_ERRORS: CommandErrors<GetCustomImageSizeErrorCodes> = {
  "662e": { message: "Invalid state, no background image loaded." },
  "662f": { message: "Invalid state, device is in recovery mode." },
};

export type GetCustomImageSizeCommandResult = CommandResult<
  GetCustomImageSizeResponse,
  GetCustomImageSizeErrorCodes
>;

export class GetCustomImageSizeCommandError extends DeviceExchangeError<GetCustomImageSizeErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<GetCustomImageSizeErrorCodes>) {
    super({ message, errorCode, tag: "GetCustomImageSizeCommandError" });
  }
}

export class GetCustomImageSizeCommand
  implements
    Command<GetCustomImageSizeResponse, void, GetCustomImageSizeErrorCodes>
{
  readonly name = "getCustomImageSize";

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x64,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(apduResponse: ApduResponse): GetCustomImageSizeCommandResult {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, IMAGE_SIZE_ERRORS)) {
        return CommandResultFactory({
          error: new GetCustomImageSizeCommandError({
            ...IMAGE_SIZE_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    const size = parser.extract32BitUInt();
    if (size === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Didn't receive any size"),
      });
    }

    return CommandResultFactory({
      data: size,
    });
  }
}
