import { type DefaultWallet, type RegisteredWallet } from "@api/model/Wallet";
import { type Wallet } from "@internal/wallet/model/Wallet";

export interface WalletBuilder {
  fromDefaultWallet(
    masterFingerprint: Uint8Array,
    extendedPublicKey: string,
    defaultWallet: DefaultWallet,
  ): Wallet;

  fromRegisteredWallet(registeredWallet: RegisteredWallet): Wallet;
}
