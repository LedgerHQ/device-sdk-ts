import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandErrorArgs,
  type CommandErrors,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  DeviceExchangeError,
  DeviceModelId,
  GlobalCommandErrorHandler,
  InvalidArgumentError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

export const MASTER_CONSENT_SUPPORTED_DEVICE_MODEL_IDS = [
  DeviceModelId.STAX,
  DeviceModelId.FLEX,
  DeviceModelId.APEX,
] as const;

export function isMasterConsentSupported(
  deviceModelId: DeviceModelId,
): boolean {
  return (
    MASTER_CONSENT_SUPPORTED_DEVICE_MODEL_IDS as readonly DeviceModelId[]
  ).includes(deviceModelId);
}

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
