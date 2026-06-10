import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetTvkDAReturnType } from "@api/app-binder/GetTvkDeviceActionTypes";
import { type GetViewKeyDAReturnType } from "@api/app-binder/GetViewKeyDeviceActionTypes";
import { type SignFeeIntentDAReturnType } from "@api/app-binder/SignFeeIntentDeviceActionTypes";
import { type SignNestedCallDAReturnType } from "@api/app-binder/SignNestedCallDeviceActionTypes";
import { type SignRootIntentDAReturnType } from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type GetTvkOptions } from "@api/model/GetTvkOptions";
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

  getTvk: (
    derivationPath: string,
    options?: GetTvkOptions,
  ) => GetTvkDAReturnType;

  signRootIntent: (
    derivationPath: string,
    rootIntent: Uint8Array,
    options?: TransactionOptions,
  ) => SignRootIntentDAReturnType;

  signNestedCall: (
    nestedCallRequest: Uint8Array,
    options?: TransactionOptions,
  ) => SignNestedCallDAReturnType;

  signFeeIntent: (
    feeIntent: Uint8Array,
    options?: TransactionOptions,
  ) => SignFeeIntentDAReturnType;
}
