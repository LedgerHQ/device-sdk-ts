// import { type AddressOptions } from "@api/model/AddressOptions";
// import { type Psbt } from "@api/model/Psbt";
// import { type Signature } from "@api/model/Signature";
// import { type Wallet } from "@api/model/Wallet";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type GetExtendedPublicKeyReturnType } from "@root/src";

export interface SignerBtc {
  getExtendedPublicKey: (
    derivationPath: string,
    options: AddressOptions,
  ) => GetExtendedPublicKeyReturnType;
  // getAddress: (wallet: Wallet, options?: AddressOptions) => Promise<string>;
  // signMessage: (wallet: Wallet, message: string) => Promise<Signature>;
  // signPsbt: (wallet: Wallet, psbt: Psbt) => Promise<Psbt>;
  // signTransaction: (wallet: Wallet, psbt: Psbt) => Promise<Uint8Array>;
}
