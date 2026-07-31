import {
  SOLANA_APP_COMMAND_ERROR_TAG,
  SolanaAppCommandError,
} from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export { SolanaAppCommandError };

/**
 * Type guard to detect a Solana app command error (e.g. user rejection `6985`)
 * without importing from the internal API.
 *
 * The check is intentionally structural (based on the `_tag` contract) rather
 * than `instanceof`: the kit is published in both ESM and CJS, so a consumer
 * graph can end up with more than one copy/format of the class. An `instanceof`
 * guard would return `false` for an error minted by a different copy of the
 * class even though it is semantically the same error. Testing `_tag` mirrors
 * what the kit already does internally and is immune to that duplication.
 */
export const isSolanaAppError = (
  error: unknown,
): error is SolanaAppCommandError =>
  typeof error === "object" &&
  error !== null &&
  (error as { _tag?: unknown })._tag === SOLANA_APP_COMMAND_ERROR_TAG &&
  typeof (error as { errorCode?: unknown }).errorCode === "string";
