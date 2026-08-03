import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignUpdateCallDAReturnType } from "@api/app-binder/SignUpdateCallDeviceActionTypes";

export type AddressOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};

export type CommonOptions = {
  skipOpenApp?: boolean;
};

export type TransactionOptions = CommonOptions & {
  // Sign a neuron-creation transfer (governance-subaccount) instead of a plain transfer.
  stake?: boolean;
};

export interface SignerIcp {
  getAppConfiguration: () => GetVersionDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  // Sign an IC update call together with its companion read-state request
  // (neuron management). Returns both signatures with the read-state body.
  signUpdateCall: (
    derivationPath: string,
    callRequest: Uint8Array,
    readStateRequest: Uint8Array,
    options?: CommonOptions,
  ) => SignUpdateCallDAReturnType;
}
