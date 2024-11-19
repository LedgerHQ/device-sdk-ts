import { type ClearSignContext } from "@/shared/model/ClearSignContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "@/shared/model/TransactionContext";

export type ContextLoader = {
  load: (transaction: TransactionContext) => Promise<ClearSignContext[]>;
  loadField?: (
    field: TransactionFieldContext,
  ) => Promise<ClearSignContext | null>;
};
