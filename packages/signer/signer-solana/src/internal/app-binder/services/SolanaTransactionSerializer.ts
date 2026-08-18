export interface SolanaTransactionSerializer {
  wrapMessageAsTransaction(
    message: Uint8Array,
    serializedTransactionForTransactionCheck?: Uint8Array,
  ): Uint8Array;
}
