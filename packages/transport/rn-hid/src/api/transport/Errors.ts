import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class HidTransportSendApduUnknownError extends GeneralDmkError {
  override readonly _tag = "HidTransportSendApduUnknownError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
