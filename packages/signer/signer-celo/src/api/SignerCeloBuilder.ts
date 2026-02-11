import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerCelo } from "@internal/DefaultSignerCelo";

type SignerCeloBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerCelo` class.
 */
export class SignerCeloBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerCeloBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerCelo({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
