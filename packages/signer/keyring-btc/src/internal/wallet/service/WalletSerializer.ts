import { Wallet } from "@internal/wallet/model/Wallet";

export interface WalletSerializer {
  serialize(wallet: Wallet): Uint8Array;
  getId(wallet: Wallet): Uint8Array;
}
