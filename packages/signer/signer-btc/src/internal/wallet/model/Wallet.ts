import { type MerkleTree } from "@internal/merkle-tree/model/MerkleTree";

export type WalletArgs = {
  readonly name: string;
  readonly descriptorTemplate: string;
  readonly keys: string[];
  readonly hmac: Uint8Array;
  readonly keysTree: MerkleTree;
  readonly descriptorBuffer: Uint8Array;
};

export class Wallet {
  public readonly name: string;
  public readonly descriptorTemplate: string;
  public readonly keys: string[];
  public readonly hmac: Uint8Array;
  public readonly keysTree: MerkleTree;
  public readonly descriptorBuffer: Uint8Array;

  constructor({
    name,
    descriptorTemplate,
    keys,
    hmac,
    keysTree,
    descriptorBuffer,
  }: WalletArgs) {
    this.name = name;
    this.descriptorTemplate = descriptorTemplate;
    this.keys = keys;
    this.hmac = hmac;
    this.keysTree = keysTree;
    this.descriptorBuffer = descriptorBuffer;
  }
}
