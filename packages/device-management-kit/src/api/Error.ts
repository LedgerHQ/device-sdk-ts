export interface DmkError {
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

export abstract class DeviceExchangeError<SpecificErrorCodes = void> {
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
    this.message = message ?? "An error occured during device exchange.";
  }
}

export class UnknownDeviceExchangeError implements DmkError {
  readonly _tag = "UnknownDeviceExchangeError";
  readonly originalError?: unknown;
  readonly message: string;

  constructor(originalError?: unknown) {
    this.originalError = originalError;
    this.message = "Unexpected device exchange error happened.";
  }
}

export class DeviceBusyError implements DmkError {
  readonly _tag = "DeviceBusyError";
  originalError?: Error;

  constructor(originalError?: Error) {
    this.originalError =
      originalError ?? new Error("Device is busy, please try again later");
  }
}
