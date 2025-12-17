import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  RegisteredWallet,
  WalletPolicy,
} from "@api/model/Wallet";
import { Leaf } from "@internal/merkle-tree/model/Leaf";
import { MerkleTree } from "@internal/merkle-tree/model/MerkleTree";
import { type MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";

import { DefaultWalletBuilder } from "./DefaultWalletBuilder";

describe("DefaultWalletBuilder tests", () => {
  const mockCreateMerkleTree = vi.fn();
  const mockMerkleTree = {
    build: mockCreateMerkleTree,
  } as unknown as MerkleTreeBuilder;

  it("Create registered wallet", () => {
    // Given
    const builder = new DefaultWalletBuilder(mockMerkleTree);
    const registeredWallet = new RegisteredWallet(
      "Cold storage",
      "wsh(sortedmulti(2,@0/**,@1/**))",
      ["key1", "key2"],
      new Uint8Array(32).fill(42),
    );
    const keysTree = new MerkleTree(
      new Leaf(new Uint8Array(), new Uint8Array(32).fill(7)),
      [],
    );

    // When
    mockCreateMerkleTree.mockReturnValueOnce(keysTree);
    const wallet = builder.fromRegisteredWallet(registeredWallet);

    // Then
    const encoder = new TextEncoder();
    expect(mockCreateMerkleTree).toHaveBeenCalledWith([
      encoder.encode("key1"),
      encoder.encode("key2"),
    ]);
    expect(wallet.name).toStrictEqual("Cold storage");
    expect(wallet.hmac).toStrictEqual(new Uint8Array(32).fill(42));
    expect(wallet.descriptorTemplate).toStrictEqual(
      "wsh(sortedmulti(2,@0/**,@1/**))",
    );
    expect(wallet.descriptorBuffer).toStrictEqual(
      encoder.encode("wsh(sortedmulti(2,@0/**,@1/**))"),
    );
    expect(wallet.keys).toStrictEqual(["key1", "key2"]);
    expect(wallet.keysTree).toStrictEqual(keysTree);
  });

  it("Create default wallet", () => {
    // Given
    const builder = new DefaultWalletBuilder(mockMerkleTree);
    const defaultWallet = new DefaultWallet(
      "48'/1'/0'/0'",
      DefaultDescriptorTemplate.NATIVE_SEGWIT,
    );
    const masterFingerprint = hexaStringToBuffer("5c9e228d")!;
    const extendedPublicKey =
      "tpubDEGquuorgFNb8bjh5kNZQMPtABJzoWwNm78FUmeoPkfRtoPF7JLrtoZeT3J3ybq1HmC3Rn1Q8wFQ8J5usanzups5rj7PJoQLNyvq8QbJruW";
    const keysTree = new MerkleTree(
      new Leaf(new Uint8Array(), new Uint8Array(32).fill(7)),
      [],
    );

    // When
    mockCreateMerkleTree.mockReturnValueOnce(keysTree);
    const wallet = builder.fromDefaultWallet(
      masterFingerprint,
      extendedPublicKey,
      defaultWallet,
    );

    // Then
    const encoder = new TextEncoder();
    expect(mockCreateMerkleTree).toHaveBeenCalledWith([
      encoder.encode(
        "[5c9e228d/48'/1'/0'/0']tpubDEGquuorgFNb8bjh5kNZQMPtABJzoWwNm78FUmeoPkfRtoPF7JLrtoZeT3J3ybq1HmC3Rn1Q8wFQ8J5usanzups5rj7PJoQLNyvq8QbJruW",
      ),
    ]);
    expect(wallet.name).toStrictEqual("");
    expect(wallet.hmac).toStrictEqual(new Uint8Array(32).fill(0));
    expect(wallet.descriptorTemplate).toStrictEqual("wpkh(@0/**)");
    expect(wallet.descriptorBuffer).toStrictEqual(
      encoder.encode("wpkh(@0/**)"),
    );
    expect(wallet.keys).toStrictEqual([
      "[5c9e228d/48'/1'/0'/0']tpubDEGquuorgFNb8bjh5kNZQMPtABJzoWwNm78FUmeoPkfRtoPF7JLrtoZeT3J3ybq1HmC3Rn1Q8wFQ8J5usanzups5rj7PJoQLNyvq8QbJruW",
    ]);
    expect(wallet.keysTree).toStrictEqual(keysTree);
  });

  it("Create wallet from wallet policy", () => {
    // Given
    const builder = new DefaultWalletBuilder(mockMerkleTree);
    const walletPolicy = new WalletPolicy(
      "My Multisig",
      "wsh(sortedmulti(2,@0/**,@1/**))",
      [
        "[76223a6e/48'/1'/0'/2']tpubDE7NQymr4AFtewpAsWtnreyq9ghkzQBXpCZjWLFVRAvnbf7vya2eMTvT2fPapNqL8SuVvLQdbUbMfWLVDCZKnsEBqp6UK93QEzL8Ck23AwF",
        "[f5acc2fd/48'/1'/0'/2']tpubDFAqEGNyad35aBCKUAXbQGDjdVhNueno5ZZVEn3sQbW5ci457gLR7HyTmHBg93oourBssgUxuWz1jX5uhc1qaqFo9VsybY1J5FuedLfm4dK",
      ],
    );
    const keysTree = new MerkleTree(
      new Leaf(new Uint8Array(), new Uint8Array(32).fill(7)),
      [],
    );

    // When
    mockCreateMerkleTree.mockReturnValueOnce(keysTree);
    const wallet = builder.fromWalletPolicy(walletPolicy);

    // Then
    const encoder = new TextEncoder();
    expect(mockCreateMerkleTree).toHaveBeenCalledWith([
      encoder.encode(
        "[76223a6e/48'/1'/0'/2']tpubDE7NQymr4AFtewpAsWtnreyq9ghkzQBXpCZjWLFVRAvnbf7vya2eMTvT2fPapNqL8SuVvLQdbUbMfWLVDCZKnsEBqp6UK93QEzL8Ck23AwF",
      ),
      encoder.encode(
        "[f5acc2fd/48'/1'/0'/2']tpubDFAqEGNyad35aBCKUAXbQGDjdVhNueno5ZZVEn3sQbW5ci457gLR7HyTmHBg93oourBssgUxuWz1jX5uhc1qaqFo9VsybY1J5FuedLfm4dK",
      ),
    ]);
    expect(wallet.name).toStrictEqual("My Multisig");
    // For wallet registration, hmac should be zeros initially (will be filled by device)
    expect(wallet.hmac).toStrictEqual(new Uint8Array(32).fill(0));
    expect(wallet.descriptorTemplate).toStrictEqual(
      "wsh(sortedmulti(2,@0/**,@1/**))",
    );
    expect(wallet.descriptorBuffer).toStrictEqual(
      encoder.encode("wsh(sortedmulti(2,@0/**,@1/**))"),
    );
    expect(wallet.keys).toStrictEqual([
      "[76223a6e/48'/1'/0'/2']tpubDE7NQymr4AFtewpAsWtnreyq9ghkzQBXpCZjWLFVRAvnbf7vya2eMTvT2fPapNqL8SuVvLQdbUbMfWLVDCZKnsEBqp6UK93QEzL8Ck23AwF",
      "[f5acc2fd/48'/1'/0'/2']tpubDFAqEGNyad35aBCKUAXbQGDjdVhNueno5ZZVEn3sQbW5ci457gLR7HyTmHBg93oourBssgUxuWz1jX5uhc1qaqFo9VsybY1J5FuedLfm4dK",
    ]);
    expect(wallet.keysTree).toStrictEqual(keysTree);
  });
});
