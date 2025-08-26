import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerCanton } from "@internal/DefaultSignerCanton";

type SignerCantonBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerCanton` class.
 *
 * @example
 * ```
 * const signer = new SignerCantonBuilder({ dmk, sessionId })
 *  .build();
 * ```
 */
export class SignerCantonBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({
    dmk,
    sessionId,
  }: SignerCantonBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the canton signer
   *
   * @returns the canton signer
   */
  public build() {
    return new DefaultSignerCanton({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
