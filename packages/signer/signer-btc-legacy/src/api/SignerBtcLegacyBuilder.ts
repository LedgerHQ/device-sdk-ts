import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { DefaultSignerBtcLegacy } from "@internal/DefaultSignerBtcLegacy";

type SignerBtcLegacyBuilderConstructorArgs<ErrorCodes extends string> = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  profile: LegacyCoinProfile<ErrorCodes>;
};

/**
 * Builder for the `SignerBtcLegacy` class.
 */
export class SignerBtcLegacyBuilder<ErrorCodes extends string> {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private readonly _profile: LegacyCoinProfile<ErrorCodes>;

  constructor({
    dmk,
    sessionId,
    profile,
  }: SignerBtcLegacyBuilderConstructorArgs<ErrorCodes>) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._profile = profile;
  }

  /**
   * Build the signer instance
   *
   * @returns the signer instance
   */
  public build() {
    return new DefaultSignerBtcLegacy({
      dmk: this._dmk,
      sessionId: this._sessionId,
      profile: this._profile,
    });
  }
}
