/**
 * Generic binary paths are a way to to navigate in any kind of structured binary data such as:
 * - transactions
 * - typed messages (EIP-712)
 * - meta transactions (EIP-2771)
 * - user operations (EIP-4337)
 * - ...
 * We follow here the concepts defined in the clear signing standard:
 * https://github.com/LedgerHQ/clear-signing-erc7730-registry/blob/master/specs/erc-7730.md#structured-data
 *
 * - The container is the structure to be signed, for instance a transaction
 * - The structured data is the data we want to navigate in, for instance a transaction calldata
 *
 * A generic path is either a field of the container, or a path in the structured data.
 * Those path will also be handled by the devices:
 * https://github.com/LedgerHQ/generic_parser/blob/master/specs.md#path_element
 */

// A generic path is either a path in the container, or a path in its data.
// Path in the data is a list of steps to apply
export type GenericPath = ContainerPathValues | DataPathElement[];

// Path in the container is only a finite list of known attributes
export enum ContainerPath {
  FROM = "FROM",
  TO = "TO",
  VALUE = "VALUE",
}
export type ContainerPathValues = keyof typeof ContainerPath;

/**
 * A path in binary data will be composed of:
 * - any number of steps of which:
 *   - Tuple: a set of elements which size if known
 *   - Array: an array of elements with dynamic size
 *   - Reference: a pointer to dereference
 * - one leaf at the end to indicate the returned element type
 *   - static leaf: 1 fixed-size chunk is returned
 *   - dynamic leaf: element of variable size is returned
 * - optionally a slice element, only allowed after the leaf, to slice the result
 *
 * An example for a transaction with that ethereum smart contract:
 * function requestWithdrawalsWithPermit(uint256[] _amounts, address _owner, (uint256,uint256,uint8,bytes32,bytes32) _permit)
 * In that case:
 * - _amounts is an array
 * - _permit is a tuple
 * We could have a tuple in an array, or an array in a tuple, in which case we would have several steps in the binary path.
 */
export type DataPathElement =
  | DataPathElementTuple
  | DataPathElementArray
  | DataPathElementRef
  | DataPathElementLeaf
  | DataPathElementSlice;
export enum DataPathElementType {
  TUPLE = "TUPLE",
  ARRAY = "ARRAY",
  REF = "REF",
  LEAF = "LEAF",
  SLICE = "SLICE",
}
export type DataPathElementTypeValues = keyof typeof DataPathElementType;

/**
 * Path element to navigate in a tuple.
 * - offset: the item of the tuple to select
 */
export interface DataPathElementTuple {
  type: "TUPLE";
  offset: number;
}

/**
 * Path element to navigate in an array of variable size.
 * - itemSize: the length of each item in that array (not the number of items which is variable).
 * - start: the start of the array slice to iterate on. If unset, start from the beginning of that array.
 * - length: the length of the array slice to iterate on. If unset, iterate until the end of that array.
 */
export interface DataPathElementArray {
  type: "ARRAY";
  itemSize: number;
  start?: number;
  length?: number;
}

// Path element to indicate the current item should be de-referenced (its value contains a pointer).
export interface DataPathElementRef {
  type: "REF";
}

/**
 * Path element to represent the leaf of the path, to be returned.
 * It is mandatory, and only allowed at the end of the path.
 * It indicates the type of data to return:
 * - Static leaf: data of static size, typically 1 chunk
 * - Dynamic leaf: data of dynamic size, typically length+data
 * - Tuple leaf: returned data is a tuple (a set of a static number of elements)
 * - Array leaf: returned data is an array (dynamic number of elements)
 */
export interface DataPathElementLeaf {
  type: "LEAF";
  leafType: DataPathLeafTypeValues;
}
export enum DataPathLeafType {
  STATIC_LEAF = "STATIC_LEAF",
  DYNAMIC_LEAF = "DYNAMIC_LEAF",
  TUPLE_LEAF = "TUPLE_LEAF",
  ARRAY_LEAF = "ARRAY_LEAF",
}
export type DataPathLeafTypeValues = keyof typeof DataPathLeafType;

/**
 * Path element to represent a slice.
 * It is optional and only allowed at the end of a path, after the leaf.
 * It means the leaf shall be sliced before being returned.
 */
export interface DataPathElementSlice {
  type: "SLICE";
  start?: number;
  end?: number;
}
