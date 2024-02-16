export interface SdkError {
  readonly _tag: string;
  originalError?: Error;
  // [could] message?: string;
}
