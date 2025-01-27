import { type DmkError } from "@api/Error";

export class HttpFetchApiError implements DmkError {
  _tag = "FetchError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}

export class WebSocketConnectionError implements DmkError {
  _tag = "WebSocketConnectionError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}
