import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { type SignerBtcLegacy } from "@api/SignerBtcLegacy";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { makeContainer } from "@internal/di";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";

type DefaultSignerBtcLegacyConstructorArgs<ErrorCodes extends string> = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  profile: LegacyCoinProfile<ErrorCodes>;
};

export class DefaultSignerBtcLegacy<ErrorCodes extends string>
  implements SignerBtcLegacy<ErrorCodes>
{
  private readonly _container: Container;

  constructor({
    dmk,
    sessionId,
    profile,
  }: DefaultSignerBtcLegacyConstructorArgs<ErrorCodes>) {
    this._container = makeContainer({ dmk, sessionId, profile });
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType<ErrorCodes> {
    return this._container
      .get<GetAddressUseCase<ErrorCodes>>(btcLegacyTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }
}
