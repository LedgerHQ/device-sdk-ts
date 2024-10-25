import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type Transaction } from "@api/model/Transaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerSolana {
  signTransaction: (
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string,
  ) => SignMessageDAReturnType;
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
  getAppConfiguration: () => GetAppConfigurationDAReturnType;
}
