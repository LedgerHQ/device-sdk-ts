import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
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

export type DeleteLanguagePackCommandArgs = {
  readonly languagePackageId: number;
};

export type DeleteLanguagePackErrorCodes = "681a";

const DELETE_LANGUAGE_PACK_ERRORS: CommandErrors<DeleteLanguagePackErrorCodes> =
  {
    "681a": { message: "Invalid LANG_ID value." },
  };

export type DeleteLanguagePackCommandResult = CommandResult<
  void,
  DeleteLanguagePackErrorCodes
>;

export class DeleteLanguagePackCommandError extends DeviceExchangeError<DeleteLanguagePackErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<DeleteLanguagePackErrorCodes>) {
    super({ message, errorCode, tag: "DeleteLanguagePackCommandError" });
  }
}

/**
 * Delete installed language package by id or delete all language packages if id = 0xFF.
 *
 * https://ledgerhq.atlassian.net/wiki/spaces/FW/pages/4455596105/Ledger+OS+-+APDU+commands#1.14.-Delete-language-pack
 */
export class DeleteLanguagePackCommand
  implements
    Command<void, DeleteLanguagePackCommandArgs, DeleteLanguagePackErrorCodes>
{
  readonly name = "deleteLanguagePack";

  constructor(private readonly args: DeleteLanguagePackCommandArgs) {}

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x33,
      p1: this.args.languagePackageId,
      p2: 0x00,
    };
    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(apduResponse: ApduResponse): DeleteLanguagePackCommandResult {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, DELETE_LANGUAGE_PACK_ERRORS)) {
        return CommandResultFactory({
          error: new DeleteLanguagePackCommandError({
            ...DELETE_LANGUAGE_PACK_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    return CommandResultFactory({
      data: undefined,
    });
  }
}
