import { type BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";

import { GetWalletAddressUseCase } from "./GetWalletAddressUseCase";

describe("GetWalletAddressUseCase", () => {
  it("should call getWalletAddress on appBinder with the correct arguments", () => {
    // given
    const wallet = {
      name: "wallet-name",
      descriptorTemplate: "wpkh(@0/**)",
      keys: ["key1", "key2"],
      hmac: new Uint8Array(32).fill(42),
      keysTree: new MerkleTree(
        new Leaf(new Uint8Array(), new Uint8Array(32).fill(7)),
        [],
      ),
      descriptorBuffer: new Uint8Array(31).fill(16),
    };
    const checkOnDevice = false;
    const change = false;
    const addressIndex = 0;

    const appBinder = {
      getWalletAddress: jest.fn(),
    };
    const getWalletAddressUseCase = new GetWalletAddressUseCase(
      appBinder as unknown as BtcAppBinder,
    );

    // when
    getWalletAddressUseCase.execute(
      checkOnDevice,
      wallet,
      change,
      addressIndex,
    );

    // then
    expect(appBinder.getWalletAddress).toHaveBeenCalledWith({
      wallet,
      checkOnDevice,
      change,
      addressIndex,
    });
  });
});
