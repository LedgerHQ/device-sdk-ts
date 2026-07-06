import { SolanaAppCommandError } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export { SolanaAppCommandError };

/**
 * Type guard to detect a Solana app command error (e.g. user rejection `6985`)
 * without importing from the internal API.
 */
export const isSolanaAppError = (
  error: unknown,
): error is SolanaAppCommandError => error instanceof SolanaAppCommandError;
