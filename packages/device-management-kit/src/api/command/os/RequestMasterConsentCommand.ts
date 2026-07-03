import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { isCommandErrorCode } from "@api/command/utils/CommandErrors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import {
  type CommandErrorArgs,
  DeviceExchangeError,
  InvalidArgumentError,
} from "@api/Error";
import {
  type Command,
  type CommandErrors,
  type CommandResult,
} from "@api/types";

export type RequestMasterConsentCommandArgs = {
  languagePackConsentEnabled: boolean;
  lockScreenPictureConsentEnabled: boolean;
  appNumber: number;
  appStorageNumber: number;
};
export type RequestMasterConsentCommandErrorCodes = "5501" | "5502";

export type RequestMasterConsentCommandResult = CommandResult<
  void,
  RequestMasterConsentCommandErrorCodes
>;
export const REQUEST_MASTER_CONSENT_ERRORS: CommandErrors<RequestMasterConsentCommandErrorCodes> =
  {
    "5501": { message: "Consent failed" },
    "5502": { message: "PIN not validated" },
  };

const assert8BitUInt = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 0x00 || value > 0xff) {
    throw new InvalidArgumentError(
      `${name} must be an integer between 0 and 255`,
    );
  }
};

export class RequestMasterConsentCommandError extends DeviceExchangeError<RequestMasterConsentCommandErrorCodes> {
  constructor(args: CommandErrorArgs<RequestMasterConsentCommandErrorCodes>) {
    super({ tag: "RequestMasterConsentCommandError", ...args });
  }
}

export class RequestMasterConsentCommand
  implements
    Command<
      void,
      RequestMasterConsentCommandArgs,
      RequestMasterConsentCommandErrorCodes
    >
{
  readonly name = "RequestMasterConsent";

  readonly args: RequestMasterConsentCommandArgs;

  private readonly header = {
    cla: 0xe0,
    ins: 0x6f,
    p1: 0x00,
    p2: 0x00,
  };

  constructor(args: RequestMasterConsentCommandArgs) {
    assert8BitUInt("appNumber", args.appNumber);
    assert8BitUInt("appStorageNumber", args.appStorageNumber);
    this.args = args;
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: this.header.cla,
      ins: this.header.ins,
      p1: this.header.p1,
      p2: this.header.p2,
    };
    return new ApduBuilder(apduArgs)
      .add8BitUIntToData(this.args.languagePackConsentEnabled ? 0x00 : 0x01)
      .add8BitUIntToData(
        this.args.lockScreenPictureConsentEnabled ? 0x00 : 0x01,
      )
      .add8BitUIntToData(this.args.appNumber)
      .add8BitUIntToData(this.args.appStorageNumber)
      .build();
  }

  parseResponse(apduResponse: ApduResponse): RequestMasterConsentCommandResult {
    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, REQUEST_MASTER_CONSENT_ERRORS)) {
        return CommandResultFactory({
          error: new RequestMasterConsentCommandError({
            ...REQUEST_MASTER_CONSENT_ERRORS[errorCode],
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
