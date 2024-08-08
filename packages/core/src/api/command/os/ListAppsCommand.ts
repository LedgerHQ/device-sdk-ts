import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import {
  CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import {
  CommandErrors,
  GlobalCommandErrorHandler,
  GlobalCommandErrorStatusCode,
  isCommandErrorCode,
} from "@api/command/utils/GlobalCommandError";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { CommandErrorArgs, DeviceExchangeError } from "@api/Error";

export type AppResponse = {
  readonly appEntryLength: number;
  readonly appSizeInBlocks: number;
  readonly appCodeHash: string;
  readonly appFullHash: string;
  readonly appName: string;
};

export type ListAppsResponse = AppResponse[];

export type ListAppsArgs = {
  readonly isContinue: boolean;
};

export type ListAppsCommandErrorCodes = "6624";

const LIST_APP_ERRORS: CommandErrors<ListAppsCommandErrorCodes> = {
  "6624": { message: "Invalid state (List applications command must be sent)" },
};

export class ListAppsCommandError extends DeviceExchangeError<ListAppsCommandErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<ListAppsCommandErrorCodes>) {
    super({ message, errorCode, tag: "ListAppsCommandError" });
  }
}

export class ListAppsCommand
  implements
    Command<
      ListAppsResponse,
      ListAppsCommandErrorCodes | GlobalCommandErrorStatusCode,
      ListAppsArgs
    >
{
  readonly args: ListAppsArgs;

  constructor(args = { isContinue: false }) {
    this.args = args;
  }

  getApdu(): Apdu {
    const listAppApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: this.args.isContinue ? 0xdf : 0xde,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(listAppApduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    ListAppsResponse,
    ListAppsCommandErrorCodes | GlobalCommandErrorStatusCode
  > {
    const res: ListAppsResponse = [];
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, LIST_APP_ERRORS)) {
        return CommandResultFactory({
          error: new ListAppsCommandError({
            ...LIST_APP_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    if (apduResponse.data.length <= 0) {
      return CommandResultFactory({
        data: [],
      });
    }

    // [NOTE] version of parsing, not used for now, skipping 1 byte
    parser.extract8BitUInt()!;

    while (parser.getUnparsedRemainingLength() > 0) {
      const appEntryLength = parser.extract8BitUInt()!;
      const appSizeInBlocks = parser.extract16BitUInt()!;
      parser.extract16BitUInt()!; // Skip 2 bytes (flags, missing in doc for now)
      const appCodeHash = parser.encodeToHexaString(
        parser.extractFieldByLength(0x20), // 32 bytes
      );
      const appFullHash = parser.encodeToHexaString(
        parser.extractFieldByLength(0x20), // 32 bytes
      );

      const appName = parser.encodeToString(parser.extractFieldLVEncoded());

      res.push({
        appEntryLength,
        appSizeInBlocks,
        appCodeHash,
        appFullHash,
        appName,
      });
    }

    return CommandResultFactory({
      data: res,
    });
  }
}
