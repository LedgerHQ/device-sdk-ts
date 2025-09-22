import { type ClearSignContext } from "@/shared/model/ClearSignContext";
import { type TransactionContext } from "@/shared/model/TransactionContext";

export type ContextLoader = {
  load: (transaction: TransactionContext) => Promise<ClearSignContext[]>;
};
