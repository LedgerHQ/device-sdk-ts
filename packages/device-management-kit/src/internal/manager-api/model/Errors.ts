import { type DmkError } from "@api/Error";

export class HttpFetchApiError implements DmkError {
  _tag = "FetchError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}

export class WebSocketError implements DmkError {
  _tag = "WebSocketError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}
