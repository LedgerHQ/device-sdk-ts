import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type Psbt } from "@api/model/Psbt";
import { type PsbtOptions } from "@api/model/PsbtOptions";
import { type Wallet, type WalletPolicy } from "@api/model/Wallet";

import { type GetWalletAddressDAReturnType } from "./app-binder/GetWalletAddressDeviceActionTypes";
import { type RegisterWalletPolicyDAReturnType } from "./app-binder/RegisterWalletPolicyTypes";
import { type WalletAddressOptions } from "./model/WalletAddressOptions";
import { type WalletPolicyOptions } from "./model/WalletPolicyOptions";

export interface SignerBtc {
  getExtendedPublicKey: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetExtendedPublicKeyDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string,
    options?: MessageOptions,
  ) => SignMessageDAReturnType;
  signPsbt: (
    wallet: Wallet,
    psbt: Psbt,
    options?: PsbtOptions,
  ) => SignPsbtDAReturnType;
  signTransaction: (
    wallet: Wallet,
    psbt: Psbt,
    options?: PsbtOptions,
  ) => SignTransactionDAReturnType;
  getWalletAddress: (
    wallet: Wallet,
    addressIndex: number,
    options?: WalletAddressOptions,
  ) => GetWalletAddressDAReturnType;
  registerWalletPolicy: (
    walletPolicy: WalletPolicy,
    options?: WalletPolicyOptions,
  ) => RegisterWalletPolicyDAReturnType;
}
