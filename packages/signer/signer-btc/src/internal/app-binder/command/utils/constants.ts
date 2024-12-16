export const PROTOCOL_VERSION = 1;

export const SHA256_SIZE = 32;

export const CHUNK_SIZE = 64;

export enum ClientCommandCodes {
  YIELD = 0x10,
  GET_PREIMAGE = 0x40,
  GET_MERKLE_LEAF_PROOF = 0x41,
  GET_MERKLE_LEAF_INDEX = 0x42,
  GET_MORE_ELEMENTS = 0xa0,
}

export const SW_INTERRUPTED_EXECUTION = Uint8Array.from([0xe0, 0x00]);
