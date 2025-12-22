import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type GetMasterFingerprintDAReturnType } from "@api/app-binder/GetMasterFingerprintDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MasterFingerprintOptions } from "@api/model/MasterFingerprintOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type Psbt } from "@api/model/Psbt";
import { type PsbtOptions } from "@api/model/PsbtOptions";
import { type Wallet } from "@api/model/Wallet";

import { type GetWalletAddressDAReturnType } from "./app-binder/GetWalletAddressDeviceActionTypes";
import { type WalletAddressOptions } from "./model/WalletAddressOptions";

export interface SignerBtc {
  getExtendedPublicKey: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetExtendedPublicKeyDAReturnType;
  getMasterFingerprint: (
    options?: MasterFingerprintOptions,
  ) => GetMasterFingerprintDAReturnType;
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
}
