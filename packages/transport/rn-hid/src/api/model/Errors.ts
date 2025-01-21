import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class HidTransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "HidTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
