import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import type { HasherService } from "@internal/merkle-tree/service/HasherService";
import { encodeVarint } from "@internal/utils/Varint";
import { Wallet } from "@internal/wallet/model/Wallet";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

const WALLET_POLICY_V2 = 2;

@injectable()
export class DefaultWalletSerializer implements WalletSerializer {
  constructor(
    @inject(merkleTreeTypes.HasherService)
    private hasher: HasherService,
  ) {}

  serialize(wallet: Wallet): Uint8Array {
    // Encode the string lengths as a bitcoin-style varint.
    // It's safe to extract here because a JS array length cannot overflow uint64.
    const descriptorLength = encodeVarint(
      wallet.descriptorBuffer.length,
    ).unsafeCoerce();
    const keysLength = encodeVarint(wallet.keys.length).unsafeCoerce();

    // Serialize as described here:
    // https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/wallet.md#wallet-policy-serialization
    return new ByteArrayBuilder()
      .add8BitUIntToData(WALLET_POLICY_V2)
      .encodeInLVFromAscii(wallet.name)
      .addBufferToData(descriptorLength)
      .addBufferToData(this.hasher.hash(wallet.descriptorBuffer))
      .addBufferToData(keysLength)
      .addBufferToData(wallet.keysTree.getRoot())
      .build();
  }

  getId(wallet: Wallet): Uint8Array {
    return this.hasher.hash(this.serialize(wallet));
  }
}
