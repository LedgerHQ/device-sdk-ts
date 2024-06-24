export interface SdkError {
  readonly _tag: string;
  originalError?: unknown;
  // [could] message?: string;
}

export interface DeviceExchangeError {
  readonly _tag: string;
  originalError?: unknown;
  errorCode: number;
}
