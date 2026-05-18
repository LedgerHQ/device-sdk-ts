import { type AccountOwnershipNetwork } from "@ledgerhq/context-module";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignCredentialDeploymentTransactionDAReturnType } from "@api/app-binder/SignCredentialDeploymentTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type VerifyAddressDAReturnType } from "@api/app-binder/VerifyAddressDeviceActionTypes";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type VerifyAddressOptions } from "@api/model/VerifyAddressOptions";

export interface SignerConcordium {
  getAppConfiguration: () => GetAppConfigDAReturnType;

  getPublicKey: (
    derivationPath: string,
    options?: PublicKeyOptions,
  ) => GetPublicKeyDAReturnType;

  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    maxFee: bigint,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  signCredentialDeploymentTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignCredentialDeploymentTransactionDAReturnType;

  verifyAddress: (
    derivationPath: string,
    address: string,
    network: AccountOwnershipNetwork,
    options?: VerifyAddressOptions,
  ) => VerifyAddressDAReturnType;
}
