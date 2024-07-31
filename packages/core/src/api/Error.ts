export interface SdkError {
  readonly _tag: string;
  readonly originalError?: unknown;
  // [could] message?: string;
}

type DeviceExchangeErrorArgs<SpecificErrorCodes> = {
  tag: string;
  originalError?: unknown;
  errorCode: SpecificErrorCodes;
  message: string;
};

export type CommandErrorArgs<SpecificErrorCodes> = Omit<
  DeviceExchangeErrorArgs<SpecificErrorCodes>,
  "tag"
>;

export abstract class DeviceExchangeError<SpecificErrorCodes> {
  readonly _tag: string;
  readonly originalError?: unknown;
  readonly errorCode: SpecificErrorCodes;
  readonly message: string;

  protected constructor({
    tag,
    errorCode,
    originalError,
    message,
  }: DeviceExchangeErrorArgs<SpecificErrorCodes>) {
    this._tag = tag;
    this.originalError = originalError;
    this.errorCode = errorCode;
    this.message = message;
  }
}

export type GlobalCommandErrorStatusCode = "5515" | "5501" | "5502";

export type CommandErrors<SpecificErrorCodes extends string> = Record<
  SpecificErrorCodes,
  Pick<CommandErrorArgs<SpecificErrorCodes>, "message">
>;

export const isCommandErrorCode = <SpecificErrorCodes extends string>(
  errorCode: string,
  errors: CommandErrors<SpecificErrorCodes>,
): errorCode is SpecificErrorCodes => errorCode in Object.keys(errors);

export class GlobalCommandError extends DeviceExchangeError<GlobalCommandErrorStatusCode> {
  override readonly _tag = "GlobalError";
  constructor({
    message,
    errorCode,
    originalError,
  }: CommandErrorArgs<GlobalCommandErrorStatusCode>) {
    super({ message, errorCode, tag: "GlobalCommandError", originalError });
  }
}

export class UnknownDeviceExchangeError implements SdkError {
  readonly _tag = "UnknownDeviceExchangeError";
  readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
  }
}
