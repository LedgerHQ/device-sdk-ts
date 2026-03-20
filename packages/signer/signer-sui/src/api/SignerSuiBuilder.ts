import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerSui } from "@internal/DefaultSignerSui";

type SignerSuiBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class SignerSuiBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerSuiBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  public build() {
    return new DefaultSignerSui({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
