import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerKaspa } from "@internal/DefaultSignerKaspa";

type SignerKaspaBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerKaspa` class.
 */
export class SignerKaspaBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerKaspaBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerKaspa({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
