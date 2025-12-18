import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import {
  DefaultWallet,
  RegisteredWallet,
  WalletPolicy,
} from "@api/model/Wallet";
import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import type { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Wallet } from "@internal/wallet/model/Wallet";
import type { WalletBuilder } from "@internal/wallet/service/WalletBuilder";

@injectable()
export class DefaultWalletBuilder implements WalletBuilder {
  constructor(
    @inject(merkleTreeTypes.MerkleTreeBuilder)
    private merkleTreeBuilder: MerkleTreeBuilder,
  ) {}

  fromRegisteredWallet(registeredWallet: RegisteredWallet): Wallet {
    const encoder = new TextEncoder();
    const keyBuffers = registeredWallet.keys.map((key) => encoder.encode(key));
    const keysTree = this.merkleTreeBuilder.build(keyBuffers);
    const descriptorBuffer = encoder.encode(
      registeredWallet.descriptorTemplate,
    );
    return new Wallet({
      name: registeredWallet.name,
      descriptorTemplate: registeredWallet.descriptorTemplate,
      keys: registeredWallet.keys,
      hmac: registeredWallet.hmac,
      keysTree: keysTree,
      descriptorBuffer,
    });
  }

  fromDefaultWallet(
    masterFingerprint: Uint8Array,
    extendedPublicKey: string,
    wallet: DefaultWallet,
  ): Wallet {
    // For internal keys, the xpub should be put after key origin informations
    // https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/wallet.md#keys-information-vector
    const hexMasterFingerprint = bufferToHexaString(masterFingerprint, false);
    const keyOrigin = `[${hexMasterFingerprint}/${wallet.derivationPath}]`;
    const key = `${keyOrigin}${extendedPublicKey}`;
    // Empty name for default wallets
    const name = "";
    // Default wallets hmac should be exactly 32 zeros as described here:
    // https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_wallet_address
    const hmac = new Uint8Array(32).fill(0);

    return this.fromRegisteredWallet(
      new RegisteredWallet(name, wallet.template, [key], hmac),
    );
  }

  fromWalletPolicy(walletPolicy: WalletPolicy): Wallet {
    const encoder = new TextEncoder();
    const keyBuffers = walletPolicy.keys.map((key) => encoder.encode(key));
    const keysTree = this.merkleTreeBuilder.build(keyBuffers);
    const descriptorBuffer = encoder.encode(walletPolicy.descriptorTemplate);
    // For wallet registration, we use an empty hmac initially.
    // The real hmac will be returned by the device after registration.
    const hmac = new Uint8Array(32).fill(0);
    return new Wallet({
      name: walletPolicy.name,
      descriptorTemplate: walletPolicy.descriptorTemplate,
      keys: walletPolicy.keys,
      hmac,
      keysTree,
      descriptorBuffer,
    });
  }
}
