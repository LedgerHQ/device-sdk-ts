import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SolanaTools {
  generateTransaction: (
    derivationPath: string,
    options?: TransactionOptions,
  ) => GenerateTransactionDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  getAppConfiguration: () => GetAppConfigurationDAReturnType;
}
