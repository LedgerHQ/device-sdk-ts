import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import {
  type BtcLegacyAppBinder,
  btcLegacyTypes,
  type GetAddressDAReturnType,
  type LegacyCoinProfile,
} from "@ledgerhq/signer-btc-legacy-core";
import { type Container } from "inversify";

import { type AddressOptions } from "@api/AddressOptions";
import { type SignerBtcLegacy } from "@api/SignerBtcLegacy";
import { makeContainer } from "@internal/di";

export class DefaultSignerBtcLegacy<ErrorCodes extends string>
  implements SignerBtcLegacy<ErrorCodes>
{
  private readonly container: Container;

  constructor(args: {
    dmk: DeviceManagementKit;
    sessionId: DeviceSessionId;
    profile: LegacyCoinProfile<ErrorCodes>;
  }) {
    this.container = makeContainer(args);
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType<ErrorCodes> {
    return this.container
      .get<BtcLegacyAppBinder<ErrorCodes>>(btcLegacyTypes.AppBinder)
      .getAddress({
        derivationPath,
        checkOnDevice: options?.checkOnDevice ?? false,
        skipOpenApp: options?.skipOpenApp ?? false,
        addressFormat: options?.addressFormat,
      });
  }
}
