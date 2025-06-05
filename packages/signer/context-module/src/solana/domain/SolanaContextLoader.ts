import { type Either } from "purify-ts";

import {
  type SolanaTransactionContext,
  type SolanaTransactionContextResult,
} from "./solanaContextTypes";

export interface SolanaContextLoader {
  load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<Either<Error, SolanaTransactionContextResult>>;
}
