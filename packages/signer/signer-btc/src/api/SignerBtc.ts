import { type AddressOptions } from "@api/model/AddressOptions";
import { type Psbt } from "@api/model/Psbt";
import { type Signature } from "@api/model/Signature";
import { type Wallet } from "@api/model/Wallet";

export interface SignerBtc {
  getExtendedPubkey: (
    derivationPath: string,
    checkOnDevice?: boolean,
  ) => Promise<string>;
  getAddress: (wallet: Wallet, options?: AddressOptions) => Promise<string>;
  signMessage: (wallet: Wallet, message: string) => Promise<Signature>;
  signPsbt: (wallet: Wallet, psbt: Psbt) => Promise<Psbt>;
  signTransaction: (wallet: Wallet, psbt: Psbt) => Promise<Uint8Array>;
}
