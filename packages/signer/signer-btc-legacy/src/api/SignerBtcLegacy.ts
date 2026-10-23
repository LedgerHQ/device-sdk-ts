import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type ExtendedPublicKeyOptions } from "@api/model/ExtendedPublicKeyOptions";

export interface SignerBtcLegacy<ErrorCodes extends string> {
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType<ErrorCodes>;

  getExtendedPublicKey: (
    derivationPath: string,
    options?: ExtendedPublicKeyOptions,
  ) => GetExtendedPublicKeyDAReturnType<ErrorCodes>;
}
