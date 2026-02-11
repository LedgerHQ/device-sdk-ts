import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";

export interface SignerCelo {
  getAppConfig: () => GetAppConfigDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
  ) => SignMessageDAReturnType;
}
