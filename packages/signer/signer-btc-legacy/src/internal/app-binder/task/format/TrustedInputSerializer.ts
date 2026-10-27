import { type LegacyTransaction } from "@api/model/CreateTransactionArg";

/**
 * The transaction format's step of the trusted input task, behind
 * `btcLegacyTypes.TrustedInputSerializer`: a kit on another format, such as
 * Zcash's v5/v6, rebinds it.
 */
export interface TrustedInputSerializer {
  // The previous transaction as the data of its 0x42 APDUs, in order. Throws
  // when the transaction misses a field of the format.
  serialize(transaction: LegacyTransaction): Uint8Array[];
}
