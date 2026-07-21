import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type SignerIcp } from "@api/SignerIcp";
import { DefaultSignerIcp } from "@internal/DefaultSignerIcp";

type SignerIcpBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerIcp` class.
 */
export class SignerIcpBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerIcpBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build(): SignerIcp {
    return new DefaultSignerIcp({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
