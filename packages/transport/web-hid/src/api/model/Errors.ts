import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class WebHidTransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "WebHidTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
export class WebHidSendReportError extends GeneralDmkError {
  override readonly _tag = "WebHidSendReportError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
