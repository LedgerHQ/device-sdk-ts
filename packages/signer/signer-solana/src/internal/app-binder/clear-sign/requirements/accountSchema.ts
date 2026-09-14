import { type CalAccountSchema } from "./calTypes";
import { type RequirementAccount } from "./model";

const FORBIDDEN = "FORBIDDEN";
const REQUIRED = "REQUIRED";
const COUNT_UNBOUNDED = 255;

/**
 * Host-side port of `poc/idl_descriptors/account_schema.py::check_account_schema`.
 *
 * Returns a human-readable mismatch description on failure, `null` on pass.
 * Called before streaming any descriptor so a stale CAL entry is detected
 * before `FINALIZE` would reject it.
 */
export function checkAccountSchema(
  schema: CalAccountSchema,
  accounts: RequirementAccount[],
): string | null {
  const count = accounts.length;

  if (count < schema.count_min) {
    return `account count ${count} below COUNT_MIN ${schema.count_min}`;
  }
  if (schema.count_max !== COUNT_UNBOUNDED && count > schema.count_max) {
    return `account count ${count} above COUNT_MAX ${schema.count_max}`;
  }

  for (let i = 0; i < count; i++) {
    const slot =
      i < schema.slots.length ? schema.slots[i]! : schema.remaining_policy;
    const account = accounts[i]!;

    if (slot.signer === FORBIDDEN && account.isSigner) {
      return `slot ${i} is a signer but the schema forbids it`;
    }
    if (slot.signer === REQUIRED && !account.isSigner) {
      return `slot ${i} is not a signer but the schema requires it`;
    }
    if (slot.writable === FORBIDDEN && account.isWritable) {
      return `slot ${i} is writable but the schema forbids it`;
    }
    if (slot.writable === REQUIRED && !account.isWritable) {
      return `slot ${i} is not writable but the schema requires it`;
    }
  }

  return null;
}
