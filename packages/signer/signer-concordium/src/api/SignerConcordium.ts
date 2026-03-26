import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";

export type PublicKeyOptions = {
  checkOnDevice?: boolean;
  skipOpenApp?: boolean;
};

export type TransactionOptions = {
  skipOpenApp?: boolean;
};

export interface SignerConcordium {
  getPublicKey: (
    derivationPath: string,
    options?: PublicKeyOptions,
  ) => GetPublicKeyDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
}
