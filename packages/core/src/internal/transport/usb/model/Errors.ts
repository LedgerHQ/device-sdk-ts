import { GeneralSdkError } from "@api/transport/model/Errors";

export class UsbHidTransportNotSupportedError extends GeneralSdkError {
  override readonly _tag = "UsbHidTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
export class HidSendReportError extends GeneralSdkError {
  override readonly _tag = "HidSendReportError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
