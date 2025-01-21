import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type Psbt } from "@api/model/Psbt";
import { type Wallet } from "@api/model/Wallet";

import { type GetWalletAddressDAReturnType } from "./app-binder/GetWalletAddressDeviceActionTypes";
import { type WalletAddressOptions } from "./model/WalletAddressOptions";

export interface SignerBtc {
  getExtendedPublicKey: (
    derivationPath: string,
    options: AddressOptions,
  ) => GetExtendedPublicKeyDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string,
  ) => SignMessageDAReturnType;
  signPsbt: (wallet: Wallet, psbt: Psbt) => SignPsbtDAReturnType;
  signTransaction: (wallet: Wallet, psbt: Psbt) => SignTransactionDAReturnType;
  getWalletAddress: (
    wallet: Wallet,
    addressIndex: number,
    options: WalletAddressOptions,
  ) => GetWalletAddressDAReturnType;
}
