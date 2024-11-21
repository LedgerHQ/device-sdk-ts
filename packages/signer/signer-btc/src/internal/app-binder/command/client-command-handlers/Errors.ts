import { type DmkError } from "@ledgerhq/device-management-kit";

export class ClientCommandHandlerError implements DmkError {
  _tag = "ClientCommandHandlerError";
  originalError?: unknown;
  constructor(err?: unknown) {
    if (err instanceof Error) {
      this.originalError = err;
    } else if (err !== undefined) {
      this.originalError = new Error(String(err));
    }
  }
}
