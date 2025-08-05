import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class LKRPHttpRequestError extends GeneralDmkError {
  override _tag = "LKRPHttpRequestError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class LKRPUnauthorizedError extends LKRPHttpRequestError {
  override _tag = "LKRPUnauthorizedError";
  constructor(override err?: unknown) {
    super(err);
  }
}

export class LKRPParsingError extends GeneralDmkError {
  override readonly _tag = "LKRPParsingError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class LKRPMissingDataError extends GeneralDmkError {
  override readonly _tag = "LKRPMissingDataError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}

export class LKRPUnhandledState extends GeneralDmkError {
  override readonly _tag = "LKRPUnhandledState";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
