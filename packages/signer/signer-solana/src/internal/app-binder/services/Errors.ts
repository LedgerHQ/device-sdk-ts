import { type DmkError } from "@ledgerhq/device-management-kit";

export class OffchainMessageBuildError implements DmkError {
  readonly _tag = "OffchainMessageBuildError";
  readonly originalError: Error;

  constructor(message: string) {
    this.originalError = new Error(message);
  }
}

export class SolanaAppVersionOutdated implements DmkError {
  readonly _tag = "SolanaAppVersionOutdated";
  readonly originalError: Error;

  constructor(message?: string) {
    this.originalError = new Error(
      message ?? "Solana app version is outdated. Please update your app.",
    );
  }
}
