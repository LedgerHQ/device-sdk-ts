import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type Transaction } from "@api/model/Transaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";

export interface SignerSolana {
  signTransaction: (
    derivationPath: string,
    transaction: Transaction,
    resolutionContext?: TransactionResolutionContext,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  signMessage: (
    derivationPath: string,
    message: string,
    options?: MessageOptions,
  ) => SignMessageDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  getAppConfiguration: () => GetAppConfigurationDAReturnType;
}
