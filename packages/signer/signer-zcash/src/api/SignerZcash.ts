import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetFullViewingKeyDAReturnType } from "@api/app-binder/GetFullViewingKeyDeviceActionTypes";
import { type GetTrustedInputDAReturnType } from "@api/app-binder/GetTrustedInputActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPcztTransactionDAReturnType } from "@api/app-binder/SignPcztTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type LegacyCreateTransactionArg } from "@api/model/CreateTransactionArg";
import { type FullViewingKeyOptions } from "@api/model/FullViewingKeyOptions";
import { type PcztTransaction } from "@api/model/PcztTransaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";

export interface SignerZcash {
  getAppConfig: () => GetAppConfigDAReturnType;

  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;

  getFullViewingKey: (
    derivationPath: string,
    options?: FullViewingKeyOptions,
  ) => GetFullViewingKeyDAReturnType;

  signTransaction: (
    args: LegacyCreateTransactionArg,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;

  /**
   * Signs an Orchard shielded (PCZT) transaction. Returns the raw per-action
   * Orchard `spendAuthSig`s and per-input transparent signatures; the binding
   * signature and final assembly are host-side (zcash-utils).
   */
  signPcztTransaction: (
    transaction: PcztTransaction,
    options?: TransactionOptions,
  ) => SignPcztTransactionDAReturnType;

  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
  ) => SignMessageDAReturnType;

  getTrustedInput: (
    transaction: Uint8Array,
    options?: { indexLookup?: number; skipOpenApp?: boolean },
  ) => GetTrustedInputDAReturnType;
}
