import { GeneralSdkError } from "@ledgerhq/device-management-kit";

export class WebHidTransportNotSupportedError extends GeneralSdkError {
  override readonly _tag = "WebHidTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
export class WebHidSendReportError extends GeneralSdkError {
  override readonly _tag = "WebHidSendReportError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
