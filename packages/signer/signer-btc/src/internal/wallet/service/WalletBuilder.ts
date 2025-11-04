import {
  type DefaultWallet,
  type RegisteredWallet,
  type WalletPolicy,
} from "@api/model/Wallet";
import {
  type InternalUnRegisteredWallet,
  type InternalWallet,
} from "@internal/wallet/model/Wallet";

export interface WalletBuilder {
  fromDefaultWallet(
    masterFingerprint: Uint8Array,
    extendedPublicKey: string,
    defaultWallet: DefaultWallet,
  ): InternalWallet;

  fromRegisteredWallet(registeredWallet: RegisteredWallet): InternalWallet;

  fromWalletPolicy(walletPolicy: WalletPolicy): InternalUnRegisteredWallet;
}
