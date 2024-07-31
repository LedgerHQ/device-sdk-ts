import { SdkError } from "@api/Error";

export class HttpFetchApiError implements SdkError {
  _tag = "FetchError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}
