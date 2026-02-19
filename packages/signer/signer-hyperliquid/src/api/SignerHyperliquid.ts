import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";

export interface SignerHyperliquid {
  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
  ) => SignMessageDAReturnType;
}
