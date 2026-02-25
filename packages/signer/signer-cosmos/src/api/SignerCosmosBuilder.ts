import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type SignerCosmos } from "@api/SignerCosmos";
import { DefaultSignerCosmos } from "@internal/DefaultSignerCosmos";

type SignerCosmosBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `SignerCosmos` class.
 */
export class SignerCosmosBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: SignerCosmosBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build(): SignerCosmos {
    return new DefaultSignerCosmos({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
