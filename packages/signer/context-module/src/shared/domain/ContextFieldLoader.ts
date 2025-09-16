import { type ClearSignContext } from "@/shared/model/ClearSignContext";

export enum ContextFieldLoaderKind {
  PROXY_DELEGATE_CALL = "proxy_delegate_call",
  TOKEN = "token",
  NFT = "nft",
  TRUSTED_NAME = "trusted_name",
}

export interface ContextFieldLoader<TInput = unknown> {
  loadField: (field: TInput) => Promise<ClearSignContext>;
  canHandle: (field: unknown) => boolean;
}
