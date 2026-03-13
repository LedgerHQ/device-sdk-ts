import { type DmkError } from "@ledgerhq/device-management-kit";

export class OffchainMessageBuildError implements DmkError {
  readonly _tag = "OffchainMessageBuildError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}
