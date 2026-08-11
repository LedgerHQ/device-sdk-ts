import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type GetECDHSecretDAReturnType } from "@api/app-binder/GetECDHSecretDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTransactionHashDAReturnType } from "@api/app-binder/SignTransactionHashDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type EcdhOptions } from "@api/model/EcdhOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerTrx {
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  signTransactionHash: (
    derivationPath: string,
    transactionHash: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionHashDAReturnType;

  signPersonalMessage: (
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ) => SignPersonalMessageDAReturnType;

  getAppConfiguration: () => GetAppConfigurationDAReturnType;

  getECDHSecret: (
    derivationPath: string,
    publicKey: Uint8Array,
    options?: EcdhOptions,
  ) => GetECDHSecretDAReturnType;
}
