import { DeviceExchangeErrorArgs } from "@api/Error";

/**
 * CommandErrors dictionary utility type
 */
export type CommandErrors<SpecificErrorCodes extends string> = Record<
  SpecificErrorCodes,
  Pick<DeviceExchangeErrorArgs<SpecificErrorCodes>, "message"> &
    Partial<Pick<DeviceExchangeErrorArgs<SpecificErrorCodes>, "tag">>
>;

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
