import { Keyring } from "@root/shared/keyring/Keyring";

export type Transaction = any;
export type Message = any;
export type Options = any;
export type Signature = any;
export type Address = any;

export interface KeyringEth extends Keyring {
  signTransaction: (
    derivationPath: string,
    transaction: Transaction,
    options: Options,
  ) => Promise<Signature>;
  signMessage: (
    derivationPath: string,
    message: Message,
    options: Options,
  ) => Promise<Signature>;
  getAddress: (derivationPath: string, options: Options) => Promise<Address>;
}
