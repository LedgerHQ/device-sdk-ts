export type TronTransactionContext = {
  /** Protobuf-serialized `Transaction.raw` bytes, as given to the signer. */
  rawTransaction: Uint8Array;
};
