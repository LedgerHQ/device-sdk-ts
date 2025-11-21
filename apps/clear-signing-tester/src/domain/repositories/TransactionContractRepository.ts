import { type TransactionInfo } from "@root/src/domain/models/TransactionInfo";

export interface TransactionContractRepository {
  getTransactions(
    address: string,
    chainId: number,
    skipCal?: boolean,
  ): Promise<TransactionInfo[]>;
}
