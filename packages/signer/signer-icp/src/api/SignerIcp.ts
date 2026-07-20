import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";

export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};

export type TransactionOptions = {
  skipOpenApp?: boolean;
};

export interface SignerIcp {
  getAppConfiguration: () => GetVersionDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
}
