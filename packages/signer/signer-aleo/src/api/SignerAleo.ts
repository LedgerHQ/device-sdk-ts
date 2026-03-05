import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetViewKeyDAReturnType } from "@api/app-binder/GetViewKeyDeviceActionTypes";
import { type SignFeeIntentDAReturnType } from "@api/app-binder/SignFeeIntentDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignRootIntentDAReturnType } from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerAleo {
  getAppConfig: () => GetAppConfigDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  getViewKey: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetViewKeyDAReturnType;

  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
  ) => SignMessageDAReturnType;

  signRootIntent: (
    derivationPath: string,
    rootIntent: Uint8Array,
    options?: TransactionOptions,
  ) => SignRootIntentDAReturnType;

  signFeeIntent: (
    feeIntent: Uint8Array,
    options?: TransactionOptions,
  ) => SignFeeIntentDAReturnType;
}
