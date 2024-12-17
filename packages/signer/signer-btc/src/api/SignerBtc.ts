import { type GetExtendedPublicKeyDAReturnType } from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignPsbtDAReturnType } from "@api/app-binder/SignPsbtDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type Psbt } from "@api/model/Psbt";
import { type Wallet } from "@api/model/Wallet";

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
  // getAddress: (wallet: Wallet, options?: AddressOptions) => Promise<string>;
  // signTransaction: (wallet: Wallet, psbt: Psbt) => Promise<Uint8Array>;
}
