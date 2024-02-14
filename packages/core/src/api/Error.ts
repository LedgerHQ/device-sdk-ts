export interface SdkError {
  readonly _tag: string;
  originalError?: Error;
  // message?: string; FUTURE ?
}
