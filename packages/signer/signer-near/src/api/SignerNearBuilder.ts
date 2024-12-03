import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerNear } from "@internal/app-binder/DefaultSignerNear";

import { type SignerNear } from "./SignerNear";

type SignerNearBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: string;
};

export class SignerNearBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerNearBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  public build(): SignerNear {
    return new DefaultSignerNear(this._dmk, this._sessionId);
  }
}
