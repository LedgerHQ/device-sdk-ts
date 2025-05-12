import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type TrustedAppLedgerKeyringProtocol } from "@api/TrustedAppLedgerKeyringProtocol";
import { makeContainer } from "@internal/di";

type DefaultTrustedAppConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultTrustedAppLedgerKeyringProtocol
  implements TrustedAppLedgerKeyringProtocol
{
  name: string;
  private _container: Container;

  constructor({ dmk, sessionId }: DefaultTrustedAppConstructorArgs) {
    this.name = "Ledger Keyring Protocol";
    this._container = makeContainer({ dmk, sessionId });
    console.log(this._container);
  }
}
