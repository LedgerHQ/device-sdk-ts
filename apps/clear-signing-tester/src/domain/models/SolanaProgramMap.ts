/**
 * Programs the Ledger Solana app can clear-sign,
 * exposed as human-friendly names for the CLI.
 */
export const SOLANA_SUPPORTED_PROGRAMS = {
  system: "11111111111111111111111111111111",
  stake: "Stake11111111111111111111111111111111111111",
  "spl-token": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "token-2022": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
} as const;

export type SolanaProgramName = keyof typeof SOLANA_SUPPORTED_PROGRAMS;

export const SOLANA_PROGRAM_NAMES = Object.keys(
  SOLANA_SUPPORTED_PROGRAMS,
) as SolanaProgramName[];
