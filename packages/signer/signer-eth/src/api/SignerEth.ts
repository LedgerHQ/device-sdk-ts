import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";

export interface SignerEth {
  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
  ) => SignPersonalMessageDAReturnType;
  signTypedData: (
    derivationPath: string,
    typedData: TypedData,
  ) => SignTypedDataDAReturnType;
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
  signDelegationAuthorization: (
    derivationPath: string,
    chainId: number,
    contractAddress: string,
    nonce: number,
  ) => SignDelegationAuthorizationDAReturnType;
}
