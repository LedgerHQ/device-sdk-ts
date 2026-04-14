import { type SolanaTransactionData } from "@root/src/domain/models/SolanaTransactionData";

export interface SolanaTransactionProgramRepository {
  getTransactions(
    programId: string,
    scanLimit?: number,
    samplesPerInstruction?: number,
  ): Promise<SolanaTransactionData[]>;
}
