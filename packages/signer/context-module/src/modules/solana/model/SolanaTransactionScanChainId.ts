/**
 * Web3Checks scan chain identifiers for Solana clusters.
 * Mirrors the backend contract for the `chain` field on Solana scan requests.
 */
export enum SolanaTransactionScanChainId {
  MAINNET = 1,
  DEVNET = 2,
  TESTNET = 3,
}
