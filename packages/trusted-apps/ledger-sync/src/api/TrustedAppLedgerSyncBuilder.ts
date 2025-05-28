import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type TrustedAppLedgerSync } from "@api/TrustedAppLedgerSync";
import { DefaultTrustedAppLedgerSync } from "@internal/DefaultTrustedAppLedgerSync";

export class TrustedAppLedgerSyncBuilder {
  private readonly dmk: DeviceManagementKit;
  private readonly sessionId: DeviceSessionId;

  constructor({
    dmk,
    sessionId,
  }: {
    dmk: DeviceManagementKit;
    sessionId: DeviceSessionId;
  }) {
    this.dmk = dmk;
    this.sessionId = sessionId;
  }

  build(): TrustedAppLedgerSync {
    return new DefaultTrustedAppLedgerSync({
      dmk: this.dmk,
      sessionId: this.sessionId,
    });
  }
}
