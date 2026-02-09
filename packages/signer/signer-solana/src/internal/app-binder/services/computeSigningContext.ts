import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

export { generateSignatureId } from "@ledgerhq/signer-utils";

export enum BlindSignReason {
  None = "none",
  InspectionFailed = "inspection_failed",
  UnrecognizedProgram = "unrecognized_program",
  TooManyInstructions = "too_many_instructions",
  AddressLookupTables = "address_lookup_tables",
  ContextBuildFailed = "context_build_failed",
  ContextProvisionFailed = "context_provision_failed",
}

export type SolanaSigningContextInfo = {
  readonly signatureId: string;
  readonly isBlindSign: boolean;
  readonly reason: BlindSignReason;
  readonly programIds: string[];
  readonly unrecognizedPrograms: string[];
  readonly instructionCount: number;
};

/**
 * Programs recognized by the Ledger Solana device app.
 * Transactions using ONLY these programs can be clear-signed by the device.
 * Any transaction containing a program NOT in this list triggers blind signing.
 *
 * Source: https://github.com/LedgerHQ/app-solana/blob/develop/libsol/instruction.c
 * Reference: https://github.com/LedgerHQ/app-solana/blob/develop/libsol/common_byte_strings.h
 */
export const DEVICE_RECOGNIZED_PROGRAMS = new Set([
  "11111111111111111111111111111111", // System Program
  "Stake11111111111111111111111111111111111111", // Stake Program
  "Vote111111111111111111111111111111111111111", // Vote Program
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // SPL Token 2022
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token Account
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", // SPL Memo
  "ComputeBudget111111111111111111111111111111", // Compute Budget
  "4MNPdKu9wFMvEeZBMt3Eipfs5ovVWTJb31pEXDJAAxX5", // Serum Assert Owner
  "DeJBGdMFa1uynnnKiwrVioatTuHmNLpyFKnmB5kaFdzQ", // Serum Assert Owner (Phantom)
]);

/**
 * Maximum number of instructions the device can clear-sign.
 * Transactions with more than this many instructions trigger blind signing.
 *
 * Source: https://github.com/LedgerHQ/app-solana/blob/develop/libsol/message.c
 */
export const MAX_DEVICE_INSTRUCTIONS = 6;

/**
 * Compute the signing context info from the inspector result.
 * Checks for structural blind sign triggers: ALTs, instruction count, unrecognized programs.
 */
export function computeSigningContext(
  inspectorResult: TxInspectorResult,
  signatureId: string,
): SolanaSigningContextInfo {
  const unrecognizedPrograms = inspectorResult.programIds.filter(
    (id) => !DEVICE_RECOGNIZED_PROGRAMS.has(id),
  );

  let isBlindSign = false;
  let reason: BlindSignReason = BlindSignReason.None;

  if (inspectorResult.usesAddressLookupTables) {
    isBlindSign = true;
    reason = BlindSignReason.AddressLookupTables;
  } else if (inspectorResult.instructionCount > MAX_DEVICE_INSTRUCTIONS) {
    isBlindSign = true;
    reason = BlindSignReason.TooManyInstructions;
  } else if (unrecognizedPrograms.length > 0) {
    isBlindSign = true;
    reason = BlindSignReason.UnrecognizedProgram;
  }

  return {
    signatureId,
    isBlindSign,
    reason,
    programIds: inspectorResult.programIds,
    unrecognizedPrograms,
    instructionCount: inspectorResult.instructionCount,
  };
}
