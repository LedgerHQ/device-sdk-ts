export type LegacyTransactionInput = {
  prevout: Uint8Array;
  script: Uint8Array;
  sequence: Uint8Array;
  tree?: Uint8Array;
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
  //witness?: Uint8Array;
  timestamp?: Uint8Array;
  nVersionGroupId?: Uint8Array;
  nExpiryHeight?: Uint8Array;
  extraData?: Uint8Array;
  consensusBranchId?: Uint8Array;
  /**
   * When set, trusted-input APDUs use these bytes (full Zcash v5 wire form)
   * instead of re-serializing from transparent `inputs` / `outputs`.
   * Use for previous transactions that include Sapling/Orchard payloads not
   * represented in `outputs` (same bytes as Ledger Wallet `splitTransaction`).
   */
  serializedPreviousTransactionOverride?: Uint8Array;
};

export type LegacyCreateTransactionArg = {
  inputs: Array<
    [
      LegacyTransaction,
      number,
      string | null | undefined,
      number | null | undefined,
      (number | null | undefined)?,
    ]
  >;
  associatedKeysets: string[];
  changePath?: string;
  outputScriptHex: string;
  lockTime?: number;
  blockHeight?: number;
  sigHashType?: number;
  additionals: string[];
  expiryHeight?: Uint8Array;
};
