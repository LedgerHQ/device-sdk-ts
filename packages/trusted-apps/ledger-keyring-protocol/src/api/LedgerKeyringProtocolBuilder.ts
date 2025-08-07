import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { DefaultLedgerKeyringProtocol } from "@internal/DefaultLedgerKeyringProtocol";

import { type LKRPEnv } from "./app-binder/LKRPTypes";

export class LedgerKeyringProtocolBuilder {
  private readonly dmk: DeviceManagementKit;
  private readonly sessionId: DeviceSessionId;
  private readonly applicationId: number;
  private readonly env?: LKRPEnv;
  private readonly baseUrl?: string;

  constructor(args: {
    dmk: DeviceManagementKit;
    sessionId: DeviceSessionId;
    applicationId: number;
    env?: LKRPEnv;
    baseUrl?: string;
  }) {
    this.dmk = args.dmk;
    this.sessionId = args.sessionId;
    this.applicationId = args.applicationId;
    this.env = args.env;
    this.baseUrl = args.baseUrl;
  }

  build(): LedgerKeyringProtocol {
    return new DefaultLedgerKeyringProtocol({
      dmk: this.dmk,
      sessionId: this.sessionId,
      applicationId: this.applicationId,
      env: this.env,
      baseUrl: this.baseUrl,
    });
  }
}
