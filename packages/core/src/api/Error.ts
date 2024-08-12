export interface SdkError {
  readonly _tag: string;
  readonly originalError?: unknown;
  message?: string;
}

export type DeviceExchangeErrorArgs<SpecificErrorCodes> = {
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

export class UnknownDeviceExchangeError implements SdkError {
  readonly _tag = "UnknownDeviceExchangeError";
  readonly originalError?: unknown;
  readonly message: string;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
    this.message = "Unexpected device exchange error happened.";
  }
}
