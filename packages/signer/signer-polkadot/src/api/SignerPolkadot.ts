import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerPolkadot {
  getAddress: (
    derivationPath: string,
    ss58Prefix: number,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    blob: Uint8Array,
    metadata: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
}
