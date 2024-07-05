import { TransactionSubset } from "@/shared/model/TransactionSubset";

export type TransactionContext = TransactionSubset & {
  challenge: string;
  domain?: string;
};
