import { type ClearSignContext } from "@/shared/model/ClearSignContext";
import { type TransactionFieldContext } from "@/shared/model/TransactionFieldContext";

export enum ContextFieldLoaderKind {
  PROXY_DELEGATE_CALL = "proxy_delegate_call",
  TOKEN = "token",
  NFT = "nft",
  TRUSTED_NAME = "trusted_name",
}

export interface ContextFieldLoader<T extends ContextFieldLoaderKind> {
  kind: T;
  loadField: (field: TransactionFieldContext<T>) => Promise<ClearSignContext>;
}
