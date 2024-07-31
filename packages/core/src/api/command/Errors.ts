import { ApduParser } from "@api/apdu/utils/ApduParser";
import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  CommandErrors,
  GlobalCommandError,
  GlobalCommandErrorStatusCode,
  isCommandErrorCode,
  SdkError,
  UnknownDeviceExchangeError,
} from "@api/Error";

export class InvalidStatusWordError implements SdkError {
  readonly _tag = "InvalidStatusWordError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid status word.");
  }
}

export class InvalidBatteryStatusTypeError implements SdkError {
  readonly _tag = "InvalidBatteryStatusTypeError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery status type.");
  }
}

export class InvalidBatteryDataError implements SdkError {
  readonly _tag = "InvalidBatteryDataError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery data.");
  }
}

export class InvalidBatteryFlagsError implements SdkError {
  readonly _tag = "InvalidBatteryFlagsError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid battery flags.");
  }
}

export class InvalidResponseFormatError implements SdkError {
  readonly _tag = "InvalidResponseFormatError";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Invalid response format.");
  }
}

const GLOBAL_ERRORS: CommandErrors<GlobalCommandErrorStatusCode> = {
  "5515": { message: "Device is locked." },
  "5501": { message: "Action refused on device." },
  "5502": { message: "Pin is not set" },
};

export class GlobalErrorHandler {
  static handle(
    apduResponse: ApduResponse,
  ): GlobalCommandError | UnknownDeviceExchangeError {
    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
    if (isCommandErrorCode(errorCode, GLOBAL_ERRORS)) {
      return new GlobalCommandError({ ...GLOBAL_ERRORS[errorCode], errorCode });
    }
    return new UnknownDeviceExchangeError({
      message: "UnknownError",
      errorCode,
    });
  }
}
