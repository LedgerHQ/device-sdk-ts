import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
// import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type SignDoc } from "@api/model/SignDoc";
// import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerCosmos {
  signTransaction: (
    derivationPath: string,
    signDoc: SignDoc,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  // signMessage: (
  //   derivationPath: string,
  //   message: string | Uint8Array,
  //   options?: MessageOptions,
  // ) => SignMessageDAReturnType;
  getAddress: (
    derivationPath: string,
    prefix: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
}
