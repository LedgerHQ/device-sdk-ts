// Shaped like hw-app-btc's `Transaction` and `CreateTransactionArg`, with bytes
// instead of Buffers, so that Ledger Wallet passes what it builds today.
export type LegacyTransactionInput = {
  prevout: Uint8Array;
  script: Uint8Array;
  sequence: Uint8Array;
};

export type LegacyTransactionOutput = {
  amount: Uint8Array;
  script: Uint8Array;
};

export type LegacyTransaction = {
  version: Uint8Array;
  inputs: LegacyTransactionInput[];
  outputs?: LegacyTransactionOutput[];
  locktime?: Uint8Array;
};

export type LegacyCreateTransactionArg = {
  // [previous transaction, output index, redeem script, sequence, block height]
  // As in hw-app-btc, the redeem script is only hashed, the signed input
  // script holds the signature and public key.
  // The block height is only read by Zcash, Ledger Wallet sends it for every coin.
  inputs: Array<
    [
      LegacyTransaction,
      number,
      (string | null)?,
      (number | null)?,
      (number | null)?,
    ]
  >;
  associatedKeysets: string[];
  changePath?: string;
  outputScriptHex: string;
  lockTime?: number;
  sigHashType?: number;
  // The inputs spend SegWit outputs, signed with BIP143: native with "bech32"
  // in additionals, P2SH-wrapped otherwise.
  segwit?: boolean;
  // hw-app-btc's flags. The kit reads "bech32" and ignores the others.
  additionals?: string[];
};
