import { COMPUTE_BUDGET_PROGRAM_ID } from "@internal/app-binder/constants";
import { type NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";

export type TopLevelInstruction = {
  /** Base58 ID of the program the instruction calls. */
  programId: string;
  /** Raw instruction data. */
  data: Uint8Array;
};

/**
 * The top-level instructions that matter for routing and gating, in message
 * order. ComputeBudget is left out (it is in neither CAL list).
 *
 * An instruction whose program ID index points into a lookup table is left
 * out, as on the device: it is either missing from `allKeys` or, when the
 * parser kept ALT refs, a placeholder key that reads as the System Program.
 * The Solana runtime never loads a program ID from a lookup table, so no real
 * instruction is lost.
 */
export function topLevelInstructions(
  message: NormalizedMessage,
): TopLevelInstruction[] {
  return message.compiledInstructions.flatMap((ix) => {
    if (message.addressLookupRefs?.[ix.programIdIndex] !== undefined) {
      return [];
    }
    const programId = message.allKeys[ix.programIdIndex]?.toBase58();
    return programId === undefined || programId === COMPUTE_BUDGET_PROGRAM_ID
      ? []
      : // Legacy messages hold a Buffer: hand over plain bytes.
        [{ programId, data: Uint8Array.from(ix.data) }];
  });
}
