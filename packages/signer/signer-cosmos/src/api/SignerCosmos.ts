import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";

export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};

export type TransactionOptions = {
  skipOpenApp?: boolean;
};

export interface SignerCosmos {
  getAppConfig: () => GetAppConfigDAReturnType;

  getAddress: (
    derivationPath: string,
    hrp: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    hrp: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
}
