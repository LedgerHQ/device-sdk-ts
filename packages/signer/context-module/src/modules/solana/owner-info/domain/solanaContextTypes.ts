import { type SolanaContext } from "@/modules/solana/model/SolanaContextTypes";

export type {
  SolanaSPLOwnerInfo,
  SolanaTransactionContext,
} from "@/modules/solana/model/SolanaTransactionContext";

export type SolanaTransactionContextResultSuccess = {
  loadersResults: SolanaContext[];
  contextErrorCount: number;
};
