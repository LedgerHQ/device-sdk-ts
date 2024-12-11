import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerBtc } from "@internal/DefaultSignerBtc";

type SignerBtcBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerBtc` class.
 *
 * @example
 * ```
 * const signer = new SignerBtcBuilder({ dmk, sessionId })
 *  .build();
 * ```
 */
export class SignerBtcBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerBtcBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the solana signer
   *
   * @returns the solana signer
   */
  public build() {
    return new DefaultSignerBtc({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
