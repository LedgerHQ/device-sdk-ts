import { type ClearSignContext } from "@/shared/model/ClearSignContext";
import { type TransactionContext } from "@/shared/model/TransactionContext";
import { type TransactionFieldContext } from "@/shared/model/TransactionFieldContext";

export type ContextLoader = {
  load: (transaction: TransactionContext) => Promise<ClearSignContext[]>;
  loadField?: (
    field: TransactionFieldContext,
  ) => Promise<ClearSignContext | null>;
};
