import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerHedera } from "@internal/DefaultSignerHedera";

type SignerHederaBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerHedera` class.
 */
export class SignerHederaBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerHederaBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerHedera({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
