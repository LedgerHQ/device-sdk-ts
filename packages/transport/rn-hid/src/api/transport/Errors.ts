import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class SendApduError extends GeneralDmkError {
  override readonly _tag = "HidTransportSendApduUnknownError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
