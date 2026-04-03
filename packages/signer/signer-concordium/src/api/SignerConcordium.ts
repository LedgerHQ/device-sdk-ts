import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignCredentialDeploymentTransactionDAReturnType } from "@api/app-binder/SignCredentialDeploymentTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

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

  signCredentialDeploymentTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignCredentialDeploymentTransactionDAReturnType;
}
