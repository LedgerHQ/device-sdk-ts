import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Right } from "purify-ts";

import type { DataStore } from "@internal/data-store/model/DataStore";
import { merkleTreeTypes } from "@internal/merkle-tree/di/merkleTreeTypes";
import type { MerkleMap } from "@internal/merkle-tree/model/MerkleMap";
import type { HasherService } from "@internal/merkle-tree/service/HasherService";
import type { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import type { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Psbt } from "@internal/psbt/model/Psbt";
import { Value } from "@internal/psbt/model/Value";
import { walletTypes } from "@internal/wallet/di/walletTypes";
import { Wallet } from "@internal/wallet/model/Wallet";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import type { DataStoreService, PsbtCommitment } from "./DataStoreService";

@injectable()
export class DefaultDataStoreService implements DataStoreService {
  constructor(
    @inject(merkleTreeTypes.MerkleTreeBuilder)
    private merkleTreeBuilder: MerkleTreeBuilder,
    @inject(merkleTreeTypes.MerkleMapBuilder)
    private merkleMapBuilder: MerkleMapBuilder,
    @inject(walletTypes.WalletSerializer)
    private walletSerializer: WalletSerializer,
    @inject(merkleTreeTypes.HasherService)
    private hasher: HasherService,
  ) {}

  merklizeChunks(store: DataStore, chunks: Uint8Array[]): Uint8Array {
    // Merkleize the chunks, then store them
    const tree = this.merkleTreeBuilder.build(chunks);
    store.addMerkleTree(tree);
    return tree.getRoot();
  }

  merklizeWallet(store: DataStore, wallet: Wallet): void {
    // As described in commands documentation, we must expose:
    // - serialized wallet preimage
    // - descriptor template preimage
    // - keys merkle tree
    // https://github.com/LedgerHQ/app-bitcoin-new/blob/master/doc/bitcoin.md#get_wallet_address
    const serializedWallet = this.walletSerializer.serialize(wallet);
    store.addPreimage(this.hasher.hash(serializedWallet), serializedWallet);
    store.addPreimage(
      this.hasher.hash(wallet.descriptorBuffer),
      wallet.descriptorBuffer,
    );
    store.addMerkleTree(wallet.keysTree);
  }

  merklizePsbt(store: DataStore, psbt: Psbt): Either<Error, PsbtCommitment> {
    // Add the global map to the store, and get its commitment
    const globalMerkleMap = this.merklizePsbtMap(psbt.globalMap);
    const globalCommitment = globalMerkleMap.map((map) => {
      store.addMerkleMap(map);
      return map.getCommitment();
    });

    // Add the input maps to the store, and get the list of commitments
    const inputCommitments = psbt.inputMaps.reduce(
      (acc: Either<Error, Uint8Array[]>, inputMap) => {
        const inputMerkleMap = this.merklizePsbtMap(inputMap);
        return acc.chain((commitments) =>
          inputMerkleMap.map((map) => {
            store.addMerkleMap(map);
            return [...commitments, map.getCommitment()];
          }),
        );
      },
      Right([]),
    );

    // Add the output maps to the store, and get the list of commitments
    const outputCommitments = psbt.outputMaps.reduce(
      (acc: Either<Error, Uint8Array[]>, outputMap) => {
        const outputMerkleMap = this.merklizePsbtMap(outputMap);
        return acc.chain((commitments) =>
          outputMerkleMap.map((map) => {
            store.addMerkleMap(map);
            return [...commitments, map.getCommitment()];
          }),
        );
      },
      Right([]),
    );

    // Check results
    return globalCommitment.chain((globalCommitment) =>
      inputCommitments.chain((inputCommitments) =>
        outputCommitments.map((outputCommitments) => {
          // Compute a merkletree for all inputs and outputs commitments
          const inputsTree = this.merkleTreeBuilder.build(inputCommitments);
          const outputsTree = this.merkleTreeBuilder.build(outputCommitments);
          // Store the trees
          store.addMerkleTree(inputsTree);
          store.addMerkleTree(outputsTree);
          // Return all the commitments
          return {
            globalCommitment,
            inputsRoot: inputsTree.getRoot(),
            outputsRoot: outputsTree.getRoot(),
          };
        }),
      ),
    );
  }

  private merklizePsbtMap(
    map: ReadonlyMap<string, Value>,
  ): Either<Error, MerkleMap> {
    // Keys must be ordered in a MerkleMap
    const sortedMap = new Map(
      Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    );
    const keys = Array.from(sortedMap.keys()).map(
      (k) => hexaStringToBuffer(k)!,
    );
    const values = Array.from(sortedMap.values()).map((v) => v.data);
    return this.merkleMapBuilder.build(keys, values);
  }
}
