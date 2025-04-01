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
import { bufferToHexaString } from "@api/utils/HexaString";

export type ListLanguagePackCommandArgs = {
  readonly firstChunk: boolean;
};

export type ListLanguagePackResponse =
  | {
      readonly id: number;
      readonly size: number;
    }
  | undefined;

export type ListLanguagePackErrorCodes = "662d";

const LANGUAGE_PACK_ERRORS: CommandErrors<ListLanguagePackErrorCodes> = {
  "662d": {
    message:
      "Invalid LIST_ARG, first command must be sent with P1_LIST_LANGUAGE_PACKS_FIRST.",
  },
};

export type ListLanguagePackCommandResult = CommandResult<
  ListLanguagePackResponse,
  ListLanguagePackErrorCodes
>;

export class ListLanguagePackCommandError extends DeviceExchangeError<ListLanguagePackErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<ListLanguagePackErrorCodes>) {
    super({ message, errorCode, tag: "ListLanguagePackCommandError" });
  }
}

export class ListLanguagePackCommand
  implements
    Command<
      ListLanguagePackResponse,
      ListLanguagePackCommandArgs,
      ListLanguagePackErrorCodes
    >
{
  constructor(private args: ListLanguagePackCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x34,
      p1: this.args.firstChunk ? 0x00 : 0x01,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(apduResponse: ApduResponse): ListLanguagePackCommandResult {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, LANGUAGE_PACK_ERRORS)) {
        return CommandResultFactory({
          error: new ListLanguagePackCommandError({
            ...LANGUAGE_PACK_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    const tlvVersion = parser.extract8BitUInt();
    if (tlvVersion === undefined) {
      // No more language package
      return CommandResultFactory({
        data: undefined,
      });
    }

    parser.extract8BitUInt(); // total length
    const idBuffer = parser.extractFieldLVEncoded();
    if (idBuffer === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Failed to get language pack id"),
      });
    }

    const sizeBuffer = parser.extractFieldLVEncoded();
    if (sizeBuffer === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Failed to get language pack size"),
      });
    }

    const id = parseInt(bufferToHexaString(idBuffer), 16);
    const size = parseInt(bufferToHexaString(sizeBuffer), 16);
    return CommandResultFactory({
      data: { id, size },
    });
  }
}
