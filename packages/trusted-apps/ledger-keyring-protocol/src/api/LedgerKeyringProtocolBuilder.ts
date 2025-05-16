import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { DefaultLedgerKeyringProtocol } from "@internal/DefaultLedgerKeyringProtocol";

export class LedgerKeyringProtocolBuilder {
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

  build(): LedgerKeyringProtocol {
    return new DefaultLedgerKeyringProtocol({
      dmk: this.dmk,
      sessionId: this.sessionId,
    });
  }
}
