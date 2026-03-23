import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type SignerConcordium } from "@api/SignerConcordium";
import { DefaultSignerConcordium } from "@internal/DefaultSignerConcordium";

type SignerConcordiumBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class SignerConcordiumBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerConcordiumBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  public build(): SignerConcordium {
    return new DefaultSignerConcordium({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
