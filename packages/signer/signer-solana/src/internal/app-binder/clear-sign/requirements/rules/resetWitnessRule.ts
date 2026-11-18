import {
  type MatchedInstruction,
  type RequirementInstruction,
} from "@internal/app-binder/clear-sign/requirements/model";
import { type ParsedInstruction } from "@internal/app-binder/clear-sign/requirements/records";
import { type RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import { accountAltRefAt } from "@internal/app-binder/clear-sign/requirements/valueResolution";

/**
 * `ALT_RESOLUTION` for both ends of every witnessed `RESET_SCOPE`
 * (`spec/dmk/clear_signing_pipeline.md`, "ALT_RESOLUTION references").
 *
 * A witnessed reset (sRFC 41, e.g. Jupiter's `setTokenLedger`) is relied on
 * only by a later instruction whose account at `CONSUMER_ACCOUNT_INDEX` has the
 * same address as the declaring instruction's account at `WITNESS_RESET_INDEX`
 * (the ledger). The device compares the two addresses, and an ALT slot with no
 * attested resolution has no address and equals nothing. Either end left
 * unresolved therefore makes the witness admit no consumer, and the route stays
 * apart from the reset that funds it. The consumer end is usually read-only
 * (`routeWithTokenLedger` only reads the ledger), so the writable-list category
 * of `applyAltResolutionRule` does not reach it.
 *
 * This rule reads the whole transaction. Candidates are the instructions
 * *after* the declaring one whose program id is the scope's and whose data
 * starts with a consumer's discriminator. Every candidate's slot is streamed
 * without comparing addresses, since an ALT-supplied address is unknown here:
 * the device applies the rest of the match (the two addresses, and no write to
 * the ledger in between). A `CONSUMER_ACCOUNT_INDEX` out of range of a
 * candidate only means that consumer does not admit it, so it is skipped.
 *
 * Streaming these entries is what lets the legitimate merge happen. It is never
 * what keeps the merge safe: an entry the host fails to stream makes the device
 * reject the consumer, not admit it.
 */
export function applyResetWitnessRule(
  instructions: { match: MatchedInstruction; records: ParsedInstruction }[],
  accumulator: RequirementAccumulator,
): void {
  instructions.forEach(({ match, records }, declaringIndex) => {
    for (const { witness } of records.accountResets) {
      if (witness === undefined) continue;
      requestSlot(match.instruction, witness.resetAccountIndex, accumulator);
      for (const later of instructions.slice(declaringIndex + 1)) {
        const candidate = later.match.instruction;
        if (candidate.programId !== witness.programId) continue;
        for (const consumer of witness.consumers) {
          if (startsWith(candidate.data, consumer.discriminator)) {
            requestSlot(candidate, consumer.accountIndex, accumulator);
          }
        }
      }
    }
  });
}

/** Request the slot's resolution when an ALT supplies it; no-op otherwise. */
function requestSlot(
  instruction: RequirementInstruction,
  accountIndex: number,
  accumulator: RequirementAccumulator,
): void {
  const altRef = accountAltRefAt(instruction, accountIndex);
  if (altRef === undefined) return;
  accumulator.addAltResolution(altRef.altAddress, altRef.entryIndex);
}

function startsWith(data: Uint8Array, prefix: Uint8Array): boolean {
  return (
    prefix.length <= data.length &&
    prefix.every((byte, index) => data[index] === byte)
  );
}
