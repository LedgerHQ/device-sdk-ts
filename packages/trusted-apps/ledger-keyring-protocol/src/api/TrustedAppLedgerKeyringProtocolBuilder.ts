import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type TrustedAppLedgerKeyringProtocol } from "@api/TrustedAppLedgerKeyringProtocol";
import { DefaultTrustedAppLedgerKeyringProtocol } from "@internal/DefaultTrustedAppLedgerKeyringProtocol";

export class TrustedAppLedgerKeyrigProtocolBuilder {
  private readonly dmk: DeviceManagementKit;
  private readonly sessionId: DeviceSessionId;

  constructor(dmk: DeviceManagementKit, sessionId: DeviceSessionId) {
    this.dmk = dmk;
    this.sessionId = sessionId;
  }

  build(): TrustedAppLedgerKeyringProtocol {
    return new DefaultTrustedAppLedgerKeyringProtocol({
      dmk: this.dmk,
      sessionId: this.sessionId,
    });
  }
}
