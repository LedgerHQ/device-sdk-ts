export interface SdkError {
  readonly _tag: string;
  readonly originalError?: unknown;
  // [could] message?: string;
}

export interface DeviceExchangeError {
  readonly _tag: string;
  readonly originalError?: unknown;
  readonly errorCode: number;
}
