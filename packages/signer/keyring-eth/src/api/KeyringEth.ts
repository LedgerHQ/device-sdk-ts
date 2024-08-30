import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { AddressOptions } from "@api/model/AddressOptions";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { TypedData } from "@api/model/TypedData";

import { SignPersonalMessageDAReturnType } from "./app-binder/SignPersonalMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "./app-binder/SignTransactionDeviceActionTypes";

export interface KeyringEth {
  signTransaction: (
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string,
  ) => SignPersonalMessageDAReturnType;
  signTypedData: (
    derivationPath: string,
    typedData: TypedData,
  ) => SignTypedDataDAReturnType;
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
}
