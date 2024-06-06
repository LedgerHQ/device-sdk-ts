export interface SdkError {
  readonly _tag: string;
  originalError?: unknown;
  // [could] message?: string;
}
