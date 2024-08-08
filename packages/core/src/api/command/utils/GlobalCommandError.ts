import { ApduParser } from "@api/apdu/utils/ApduParser";
import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  CommandErrorArgs,
  DeviceExchangeError,
  DeviceExchangeErrorArgs,
  UnknownDeviceExchangeError,
} from "@api/Error";

/**
 * Status word list of global errors that any command could result
 */
export type GlobalCommandErrorStatusCode = "5515" | "5501" | "5502" | "5223";

/**
 * Global command error class
 */
export class GlobalCommandError extends DeviceExchangeError<GlobalCommandErrorStatusCode> {
  constructor(args: CommandErrorArgs<GlobalCommandErrorStatusCode>) {
    super({ tag: "GlobalCommandError", ...args });
  }
}

/**
 * CommandErrors dictionary utility type
 */
export type CommandErrors<SpecificErrorCodes extends string> = Record<
  SpecificErrorCodes,
  Pick<DeviceExchangeErrorArgs<SpecificErrorCodes>, "message"> &
    Partial<Pick<DeviceExchangeErrorArgs<SpecificErrorCodes>, "tag">>
>;

/**
 * Global errors dictionary that links a global status code to an error message
 */
const GLOBAL_ERRORS: CommandErrors<GlobalCommandErrorStatusCode> = {
  "5515": { message: "Device is locked.", tag: "DeviceLockedError" },
  "5501": { message: "Action refused on device.", tag: "ActionRefusedError" },
  "5502": { message: "Pin is not set", tag: "PinNotSetError" },
  "5223": { message: "Device internal error", tag: "DeviceInternalError" },
};

/**
 * Typeguard to check if an error status code is handled
 *
 * @param errorCode
 * @param errors
 */
export const isCommandErrorCode = <SpecificErrorCodes extends string>(
  errorCode: string,
  errors: CommandErrors<SpecificErrorCodes>,
): errorCode is SpecificErrorCodes => Object.keys(errors).includes(errorCode);

/**
 * Global error handler utility class
 */
export class GlobalCommandErrorHandler {
  /**
   * Static method to get a handled GlobalCommandError or an unhandled SdkError from an apdu response
   * @param apduResponse
   */
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
