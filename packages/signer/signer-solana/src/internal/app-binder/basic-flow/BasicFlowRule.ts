export type InstructionMatcher = {
  /** Base58 program ID. */
  programId: string;
  /**
   * Only these instructions of the program, by prefix match on the
   * instruction data (u32 LE for native programs, 8-byte Anchor discriminator
   * for Anchor programs). Absent = any instruction of the program.
   */
  discriminators?: ReadonlyArray<Uint8Array>;
};

/**
 * Sends a transaction to the basic flow, skipping generic clear
 * signing, when at least one of its instructions matches `required` and every
 * instruction matches `required` or `allowed`.
 */
export type BasicFlowRule = {
  /** Used in logs, e.g. "native-staking". */
  id: string;
  required: ReadonlyArray<InstructionMatcher>;
  allowed: ReadonlyArray<InstructionMatcher>;
};
