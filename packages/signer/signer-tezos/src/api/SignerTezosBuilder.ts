import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { DefaultSignerTezos } from "@internal/DefaultSignerTezos";

type SignerTezosBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerTezos` class.
 */
export class SignerTezosBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerTezosBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerTezos({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
