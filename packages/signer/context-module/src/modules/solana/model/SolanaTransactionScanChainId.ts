/**
 * Web3Checks scan chain identifiers for Solana clusters.
 * Mirrors the backend contract for the `chain` field on Solana scan requests:
 * the extended network ids (900/901/902) introduced in the latest spec.
 */
export enum SolanaTransactionScanChainId {
  MAINNET = 900,
  DEVNET = 901,
  TESTNET = 902,
}
