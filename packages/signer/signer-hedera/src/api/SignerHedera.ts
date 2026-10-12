import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AppConfigOptions } from "@api/model/AppConfigOptions";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerHedera {
  getAppConfig: (options?: AppConfigOptions) => GetAppConfigDAReturnType;

  getPublicKey: (
    keyIndex: number,
    options?: PublicKeyOptions,
  ) => GetPublicKeyDAReturnType;

  signTransaction: (
    keyIndex: number,
    transactionBody: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
}
