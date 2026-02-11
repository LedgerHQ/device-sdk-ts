import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerConcordium } from "@internal/DefaultSignerConcordium";

type SignerConcordiumBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerConcordium` class.
 */
export class SignerConcordiumBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerConcordiumBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerConcordium({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
