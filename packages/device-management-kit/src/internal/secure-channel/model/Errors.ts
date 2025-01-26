import { type DmkError } from "@api/Error";

export class WebSocketConnectionError implements DmkError {
  _tag = "WebSocketConnectionError";
  originalError?: unknown;

  constructor(public readonly error: unknown) {
    this.originalError = error;
  }
}
