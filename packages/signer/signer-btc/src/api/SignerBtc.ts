import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type Psbt } from "@api/model/Psbt";
import { type Wallet } from "@api/model/Wallet";

import { type GetWalletAddressDAReturnType } from "./app-binder/GetWalletAddressDeviceActionTypes";
import { WalletAddressOptions } from "./model/WalletAddressOptions";

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
  getWalletAddress: (
    wallet: Wallet,
    addressIndex: number,
    options: WalletAddressOptions,
  ) => GetWalletAddressDAReturnType;
  // signTransaction: (wallet: Wallet, psbt: Psbt) => Promise<Uint8Array>;
}
