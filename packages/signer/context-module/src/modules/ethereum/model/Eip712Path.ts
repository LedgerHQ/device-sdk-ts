/**
 * Where an EIP-712 V2 field descriptor reads its value, as specified in
 * https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/tlv_structs.md#eip712_path
 *
 * A path walks the value tree of the message from its root struct, one step at a time:
 * - STRUCT_FIELD: go into the field of the current struct at that declaration index
 * - ARRAY_SLICE: go into the elements [start, end) of the current array, all of them when
 *   both bounds are absent. A negative bound counts from the end of the array.
 * - LEAF_SLICE: keep the bytes [start, end) of the leaf reached, only allowed last
 *
 * The domain is out of reach of a path: its values are read through a container path.
 */
export type Eip712Path = Eip712PathElement[];

export type Eip712PathElement =
  | Eip712PathElementStructField
  | Eip712PathElementArraySlice
  | Eip712PathElementLeafSlice;

export interface Eip712PathElementStructField {
  type: "STRUCT_FIELD";
  index: number;
}

export interface Eip712PathElementArraySlice {
  type: "ARRAY_SLICE";
  start?: number;
  end?: number;
}

export interface Eip712PathElementLeafSlice {
  type: "LEAF_SLICE";
  start?: number;
  end?: number;
}

/**
 * The values of a typed message a descriptor reads outside of its value tree:
 * - FROM: the account that signs
 * - TO: the verifyingContract of the domain
 * - CHAIN_ID: the chainId of the domain
 */
export type Eip712ContainerPath = "FROM" | "TO" | "CHAIN_ID";

export type Eip712ValuePath = Eip712ContainerPath | Eip712Path;
