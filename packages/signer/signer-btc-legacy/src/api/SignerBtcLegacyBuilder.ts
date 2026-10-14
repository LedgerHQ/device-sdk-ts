import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type LegacyCoinProfile } from "@ledgerhq/signer-btc-legacy-core";

import { DefaultSignerBtcLegacy } from "@internal/DefaultSignerBtcLegacy";

type SignerBtcLegacyBuilderConstructorArgs<ErrorCodes extends string> = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  /** The coin: app name, error map, protocol variants. */
  profile: LegacyCoinProfile<ErrorCodes>;
};

export class SignerBtcLegacyBuilder<ErrorCodes extends string> {
  constructor(
    private readonly args: SignerBtcLegacyBuilderConstructorArgs<ErrorCodes>,
  ) {}

  public build() {
    return new DefaultSignerBtcLegacy<ErrorCodes>(this.args);
  }
}
