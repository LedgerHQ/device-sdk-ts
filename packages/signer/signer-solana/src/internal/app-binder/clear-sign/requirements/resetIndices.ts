import { type CalAccountReset } from "./calTypes";

/**
 * Range-check the indices a descriptor's `ACCOUNT_RESET`s take into the
 * declaring instruction's own accounts: each reset's `ACCOUNT_INDEX` and, for
 * a witnessed scope, its `WITNESS_RESET_INDEX`. The device refuses the whole
 * transaction at finalize when either is out of range, since the descriptor
 * then does not describe the instruction it was matched to. Checking here falls
 * back before anything is streamed.
 *
 * A witness consumer's `account_index` is not checked: it indexes another
 * instruction's accounts, where out of range only means that consumer does not
 * admit the instruction.
 *
 * Returns `null` when every index is in range, otherwise a description of the
 * first one that is not.
 */
export function checkResetIndices(
  resets: CalAccountReset[],
  accountCount: number,
): string | null {
  for (const reset of resets) {
    if (reset.account_index >= accountCount) {
      return `ACCOUNT_RESET account_index ${reset.account_index} is out of range (${accountCount} accounts)`;
    }
    const witnessIndex = reset.reset_scope?.witness?.reset_account_index;
    if (witnessIndex !== undefined && witnessIndex >= accountCount) {
      return `RESET_SCOPE witness reset_account_index ${witnessIndex} is out of range (${accountCount} accounts)`;
    }
  }
  return null;
}
