import { type PublicKey } from "@solana/web3.js";

/**
 * The Solana RPC I/O boundary. Every network read the tools package performs
 * goes through this datasource, so the concrete web3.js `Connection` lives in a
 * single implementation instead of being created inline inside the services.
 * Services depend on this interface, which keeps them free of RPC transport
 * concerns and trivially mockable in unit tests.
 */
export interface SolanaTransactionDataSource {
  /**
   * Raw account data for each address over RPC, index-aligned with the input.
   * An entry is null when the account does not exist (never created, closed, or
   * garbage collected). Callers decide whether a missing account is fatal.
   */
  getAccountsData(
    addresses: PublicKey[],
    rpcUrl?: string,
  ): Promise<(Uint8Array | null)[]>;

  /**
   * The serialized transaction message for a signature over RPC, or null when
   * the transaction is not found.
   */
  getTransactionMessage(
    signature: string,
    rpcUrl?: string,
  ): Promise<Uint8Array | null>;
}
