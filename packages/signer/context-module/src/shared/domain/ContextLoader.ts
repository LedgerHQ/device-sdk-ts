import { ClearSignContext } from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";

export type ContextLoader = {
  load: (transaction: TransactionContext) => Promise<ClearSignContext[]>;
};
