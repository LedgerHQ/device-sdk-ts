import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";
import { HasherService } from "@internal/merkle-tree/service/HasherService";
import { Wallet } from "@internal/wallet/model/Wallet";

import { DefaultWalletSerializer } from "./DefaultWalletSerializer";

describe("DefaultWalletSerializer tests", () => {
  const mockHash = jest.fn();
  const mockHasherService: HasherService = {
    hash: mockHash,
  };

  it("Serialize a wallet", () => {
    // Given
    const walletSerializer = new DefaultWalletSerializer(mockHasherService);
    const descriptorBuffer = new Uint8Array(31).fill(16);
    const wallet = new Wallet({
      name: "Cold storage",
      descriptorTemplate: "wsh(sortedmulti(2,@0/**,@1/**))",
      keys: ["key1", "key2"],
      hmac: new Uint8Array(),
      keysTree: new MerkleTree(
        new Leaf(new Uint8Array(), new Uint8Array(32).fill(7)),
        [],
      ),
      descriptorBuffer,
    });

    // When
    mockHash.mockReturnValueOnce(new Uint8Array(32).fill(42));
    const serialized = walletSerializer.serialize(wallet);

    // Then
    expect(mockHash).toHaveBeenCalledWith(descriptorBuffer);
    expect(serialized).toStrictEqual(
      hexaStringToBuffer(
        "020c436f6c642073746f726167651f2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a020707070707070707070707070707070707070707070707070707070707070707",
      )!,
    );
  });
});
