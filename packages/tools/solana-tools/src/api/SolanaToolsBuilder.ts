import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSolanaTools } from "@internal/DefaultSolanaTools";

import { type SolanaTools } from "./SolanaTools";

type SolanaToolsBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class SolanaToolsBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SolanaToolsBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  public build(): SolanaTools {
    return new DefaultSolanaTools({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
