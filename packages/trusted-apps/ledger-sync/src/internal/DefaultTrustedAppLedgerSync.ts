import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type TrustedAppLedgerSync } from "@api/TrustedAppLedgerSync";
import { makeContainer } from "@internal/di";

type DefaultTrustedAppConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultTrustedAppLedgerSync implements TrustedAppLedgerSync {
  name: string;
  private _container: Container;

  constructor({ dmk, sessionId }: DefaultTrustedAppConstructorArgs) {
    this.name = "Ledger Sync";
    this._container = makeContainer({ dmk, sessionId });
    console.log(this._container);
  }
}
