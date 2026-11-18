import { type SolanaGatedDescriptor } from "@/modules/multichain/gated-signing/data/SolanaGatedDescriptorDataSource";

/** A top-level instruction of the message, as the matcher sees it. */
export type SolanaGatedSigningInstruction = {
  /** Base58 ID of the program the instruction calls. */
  programId: string;
  /** Raw instruction data. */
  data: Uint8Array;
};

export type SolanaGatedMatch = {
  descriptor: SolanaGatedDescriptor;
  /** Index of the matched instruction in the list given to the matcher. */
  instructionIndex: number;
};

/**
 * Whether one instruction matches one descriptor. Mirrors the check the
 * device runs:
 * - Program only: the instruction calls the program.
 * - Program and instruction: the instruction calls the program and its data
 *   starts with the discriminator.
 */
export function matchesSolanaGatedDescriptor(
  descriptor: SolanaGatedDescriptor,
  instruction: SolanaGatedSigningInstruction,
): boolean {
  if (descriptor.programId !== instruction.programId) return false;
  if (descriptor.discriminator.length === 0) return true;
  return startsWith(instruction.data, descriptor.discriminator);
}

/**
 * Picks the descriptor to send for a transaction: the screen shows when at
 * least one top-level instruction matches, so the first matching instruction
 * (in message order) wins. When several descriptors match that instruction,
 * the one with the longest discriminator wins: "program and instruction"
 * beats "program only".
 *
 * Returns `null` when no instruction matches.
 */
export function findSolanaGatedDescriptor(
  instructions: ReadonlyArray<SolanaGatedSigningInstruction>,
  descriptors: ReadonlyArray<SolanaGatedDescriptor>,
): SolanaGatedMatch | null {
  for (const [instructionIndex, instruction] of instructions.entries()) {
    let best: SolanaGatedDescriptor | null = null;
    for (const descriptor of descriptors) {
      if (
        matchesSolanaGatedDescriptor(descriptor, instruction) &&
        (best === null ||
          descriptor.discriminator.length > best.discriminator.length)
      ) {
        best = descriptor;
      }
    }
    if (best !== null) return { descriptor: best, instructionIndex };
  }
  return null;
}

function startsWith(data: Uint8Array, prefix: Uint8Array): boolean {
  return (
    data.length >= prefix.length &&
    prefix.every((byte, index) => data[index] === byte)
  );
}
