import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerSui {
  getVersion: () => GetVersionDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  signPersonalMessage: (
    derivationPath: string,
    message: Uint8Array,
    options?: MessageOptions,
  ) => SignPersonalMessageDAReturnType;
}
