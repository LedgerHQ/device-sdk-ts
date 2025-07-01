import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class LKRPHttpRequestError extends GeneralDmkError {
  override readonly _tag = "LKRPHttpRequestError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
