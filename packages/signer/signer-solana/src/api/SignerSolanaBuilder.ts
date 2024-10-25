import {
  DeviceSdk,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerSolana } from "@internal/DefaultSignerSolana";

type SignerSolanaBuilderConstructorArgs = {
  sdk: DeviceSdk;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerSolana` class.
 *
 * @example
 * ```
 * const sdk = new SignerSolanaBuilder({ sdk, sessionId })
 *  .build();
 * ```
 */
export class SignerSolanaBuilder {
  private _sdk: DeviceSdk;
  private _sessionId: DeviceSessionId;

  constructor({ sdk, sessionId }: SignerSolanaBuilderConstructorArgs) {
    this._sdk = sdk;
    this._sessionId = sessionId;
  }

  /**
   * Build the solana signer
   *
   * @returns the solana signer
   */
  public build() {
    return new DefaultSignerSolana({
      sdk: this._sdk,
      sessionId: this._sessionId,
    });
  }
}
