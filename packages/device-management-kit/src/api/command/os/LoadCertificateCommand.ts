import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, type ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
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
import { DeviceExchangeError } from "@api/Error";
import { type Command, type CommandErrorArgs } from "@api/types";

export type LoadCertificateArgs = {
  readonly keyUsage: number;
  readonly certificate: Uint8Array;
};

export type LoadCertificateErrorCodes =
  | "422f"
  | "4230"
  | "4231"
  | "4232"
  | "4233"
  | "4234"
  | "4235"
  | "4236"
  | "4237"
  | "4238"
  | "4239"
  | "422d"
  | "3301"
  | "422e"
  | "5720"
  | "4118"
  | "ffff";

const LOAD_CERTIFICATE_ERRORS: CommandErrors<LoadCertificateErrorCodes> = {
  "422f": { message: "Incorrect structure type" },
  "4230": { message: "Incorrect certificate version" },
  "4231": { message: "Incorrect certificate validity" },
  "4232": { message: "Incorrect certificate validity index" },
  "4233": { message: "Unknown signer key ID" },
  "4234": { message: "Unknown signature algorithm" },
  "4235": { message: "Unknown public key ID" },
  "4236": { message: "Unknown public key usage" },
  "4237": { message: "Incorrect elliptic curve ID" },
  "4238": {
    message: "Incorrect signature algorithm associated to the public key",
  },
  "4239": { message: "Unknown target device" },
  "422d": { message: "Unknown certificate tag" },
  "3301": { message: "Failed to hash data" },
  "422e": {
    message: "expected_key_usage doesn't match certificate key usage",
  },
  "5720": { message: "Failed to verify signature" },
  "4118": {
    message: "trusted_name buffer is too small to contain the trusted name",
  },
  ffff: { message: "Cryptography-related error" },
};

export class LoadCertificateCommandError extends DeviceExchangeError<LoadCertificateErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<LoadCertificateErrorCodes>) {
    super({ tag: "ProvidePkiCertificateCommandError", message, errorCode });
  }
}

export type LoadCertificateCommandResult = CommandResult<
  void,
  LoadCertificateErrorCodes
>;

/**
 * The command to load a certificate on the device.
 */
export class LoadCertificateCommand
  implements Command<void, LoadCertificateArgs, LoadCertificateErrorCodes>
{
  readonly name = "LoadCertificateCommand";
  readonly args: LoadCertificateArgs;
  readonly triggersDisconnection = false;

  constructor(args: LoadCertificateArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const providePkiApduArgs: ApduBuilderArgs = {
      cla: 0xb0,
      ins: 0x06,
      p1: this.args.keyUsage,
      p2: 0x00,
    };
    return new ApduBuilder(providePkiApduArgs)
      .addBufferToData(this.args.certificate)
      .build();
  }

  parseResponse(apduResponse: ApduResponse): LoadCertificateCommandResult {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }
    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
    if (isCommandErrorCode(errorCode, LOAD_CERTIFICATE_ERRORS)) {
      return CommandResultFactory({
        error: new LoadCertificateCommandError({
          ...LOAD_CERTIFICATE_ERRORS[errorCode],
          errorCode,
        }),
      });
    }
    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
