import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerTrx } from "@internal/DefaultSignerTrx";

type SignerTrxBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerTrx` class.
 *
 * @example
 * ```
 * const signer = new SignerTrxBuilder({ dmk, sessionId })
 *  .build();
 * ```
 */
export class SignerTrxBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerTrxBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the Tron signer instance
   *
   * @returns the Tron signer instance
   */
  
  public build() {
    return new DefaultSignerTrx({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
