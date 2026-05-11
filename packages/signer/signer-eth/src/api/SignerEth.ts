import { type EditExternalAddressDAReturnType } from "@api/app-binder/EditExternalAddressDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterLedgerAccountDAReturnType } from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { type SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type VerifySafeAddressDAReturnType } from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type EditExternalAddressArgs } from "@api/model/EditExternalAddressArgs";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type RegisterExternalAddressArgs } from "@api/model/RegisterExternalAddressArgs";
import { type RegisterLedgerAccountArgs } from "@api/model/RegisterLedgerAccountArgs";
import { type SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataOptions } from "@api/model/TypedDataOptions";

export interface SignerEth {
  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ) => SignPersonalMessageDAReturnType;
  signTypedData: (
    derivationPath: string,
    typedData: TypedData,
    options?: TypedDataOptions,
  ) => SignTypedDataDAReturnType;
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
  verifySafeAddress: (
    safeContractAddress: string,
    options?: SafeAddressOptions,
  ) => VerifySafeAddressDAReturnType;
  signDelegationAuthorization: (
    derivationPath: string,
    chainId: number,
    contractAddress: string,
    nonce: number,
  ) => SignDelegationAuthorizationDAReturnType;
  registerExternalAddress: (
    args: RegisterExternalAddressArgs,
  ) => RegisterExternalAddressDAReturnType;
  editExternalAddress: (
    args: EditExternalAddressArgs,
  ) => EditExternalAddressDAReturnType;
  registerLedgerAccount: (
    args: RegisterLedgerAccountArgs,
  ) => RegisterLedgerAccountDAReturnType;
}
