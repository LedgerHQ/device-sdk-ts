import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { DefaultLedgerKeyringProtocol } from "@internal/DefaultLedgerKeyringProtocol";

export class LedgerKeyringProtocolBuilder {
  private readonly dmk: DeviceManagementKit;
  private readonly sessionId: DeviceSessionId;
  private readonly baseUrl: string;

  constructor({
    dmk,
    sessionId,
    baseUrl,
  }: {
    dmk: DeviceManagementKit;
    sessionId: DeviceSessionId;
    baseUrl: string;
  }) {
    this.dmk = dmk;
    this.sessionId = sessionId;
    this.baseUrl = baseUrl;
  }

  build(): LedgerKeyringProtocol {
    return new DefaultLedgerKeyringProtocol({
      dmk: this.dmk,
      sessionId: this.sessionId,
      baseUrl: this.baseUrl,
    });
  }
}
