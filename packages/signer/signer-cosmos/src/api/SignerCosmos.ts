import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerCosmos {
  signTransaction: (
    derivationPath: string,
    serializedSignDoc: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  getAddress: (
    derivationPath: string,
    prefix: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
}
