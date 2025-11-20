import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export type LKRPDataSourceErrorStatus =
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "UNKNOWN";

export class LKRPDataSourceError extends GeneralDmkError {
  override _tag = "LedgerKeyRingProtocolError";
  public readonly message: string;
  public readonly status: LKRPDataSourceErrorStatus;

  constructor(
    readonly err: {
      status: LKRPDataSourceErrorStatus;
      message: string;
    },
  ) {
    super(err.message);
    this.status = err.status;
    this.message = err.message;
  }
}

export class LKRPUnauthorizedError extends GeneralDmkError {
  override _tag = "LedgerKeyRingProtocolError";
  constructor(
    readonly LedgerKeyRingProtocolId: string | null = null,
    readonly message: string = `Current keyPair is not a member of the LedgerKeyRingProtocol${LedgerKeyRingProtocolId ? ` ${LedgerKeyRingProtocolId}` : ""}.`,
  ) {
    super(message);
  }
}

export class LKRPOutdatedLedgerKeyRingProtocolError extends GeneralDmkError {
  override _tag = "LedgerKeyRingProtocolError";
  constructor(readonly message = "The LedgerKeyRingProtocol is outdated.") {
    super(message);
  }
}

export class LKRPLedgerKeyRingProtocolNotReady extends GeneralDmkError {
  override readonly _tag = "LedgerKeyRingProtocolError";
  constructor(
    readonly message = "Ledger Sync must be initialized from Ledger Live with this device.",
  ) {
    super(message);
  }
}

export class LKRPParsingError extends GeneralDmkError {
  override readonly _tag = "LedgerKeyRingProtocolError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class LKRPMissingDataError extends GeneralDmkError {
  override readonly _tag = "LedgerKeyRingProtocolError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class LKRPUnsupportedCommandError extends GeneralDmkError {
  override readonly _tag = "LedgerKeyRingProtocolError";
  readonly message: string;
  constructor(readonly command: unknown) {
    const commandType =
      command &&
      typeof command === "object" &&
      "type" in command &&
      typeof command.type === "number" &&
      `0x${command.type.toString(16).padStart(2, "0")}`;
    let message = `Unsupported command`;
    if (commandType) message += `: ${commandType}`;

    super(message);

    this.message = message;
  }
}

export class LKRPUnknownError extends GeneralDmkError {
  override readonly _tag = "LedgerKeyRingProtocolError";
  constructor(readonly message: string) {
    super(message);
  }
}
