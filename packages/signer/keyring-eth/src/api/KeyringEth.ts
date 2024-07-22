import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { AddressOptions } from "@api/model/AddressOptions";
import { Signature } from "@api/model/Signature";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { TypedData } from "@api/model/TypedData";

export interface KeyringEth {
  signTransaction: (
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ) => Promise<Signature>;
  signMessage: (derivationPath: string, message: string) => Promise<Signature>;
  signTypedData: (
    derivationPath: string,
    typedData: TypedData,
  ) => Promise<Signature>;
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
}
