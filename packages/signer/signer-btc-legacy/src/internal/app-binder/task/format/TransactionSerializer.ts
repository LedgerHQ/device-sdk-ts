export type SignedTransactionInput = {
  readonly prevout: Uint8Array;
  readonly script: Uint8Array;
  readonly sequence: Uint8Array;
};

/**
 * The transaction format's steps of the signing task, behind
 * `btcLegacyTypes.TransactionSerializer`: a kit on another format, such as
 * Zcash's v5/v6, rebinds it.
 */
export interface TransactionSerializer {
  // The fields before the inputs, then their count: the start of each 0x44
  // stream.
  serializeHeader(inputCount: number): Uint8Array;

  serializeSignedTransaction(args: {
    inputs: SignedTransactionInput[];
    // The outputs as the caller gave them, count included.
    outputScript: Uint8Array;
    lockTime: number;
    // One per input when they spend SegWit outputs.
    witnesses?: Uint8Array[];
  }): Uint8Array;
}
