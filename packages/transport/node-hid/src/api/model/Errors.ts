import { GeneralDmkError } from "@ledgerhq/device-management-kit";

export class NodeHidTransportNotSupportedError extends GeneralDmkError {
  override readonly _tag = "NodeHidTransportNotSupportedError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
export class NodeHidSendReportError extends GeneralDmkError {
  override readonly _tag = "NodeHidSendReportError";
  constructor(readonly err?: unknown) {
    super(err);
  }
}
