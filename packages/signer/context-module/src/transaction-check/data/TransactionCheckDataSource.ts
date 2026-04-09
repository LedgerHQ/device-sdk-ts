import { type Either } from "purify-ts";

import { type SolanaTransactionScanChainId } from "@/shared/model/Web3ChecksTypes";

export type GetTransactionCheckEthereumParams = {
  kind: "ethereum";
  /** EVM chain id */
  chainId: number;
  rawTx: string;
  from: string;
  /** dApp origin (optional). */
  domain?: string;
  /** Block height for simulation; tests only; omit for latest. */
  block?: number;
};

export type GetTransactionCheckSolanaParams = {
  kind: "solana";
  /**
   * Signer public key in `tx.from` (base58)
   * but encoding differs (base58, 32-byte pubkey).
   */
  from: string;
  /** Serialized message in `tx.raw` (base58). */
  rawTx: string;
  /**
   * Solana cluster as: 1 mainnet-beta, 2 devnet, 3 testnet. Optional.
   */
  chain?: SolanaTransactionScanChainId;
  /** dApp origin (optional). */
  domain?: string;
  /** Slot for simulation; tests only; omit for latest. */
  block?: number;
};

export type GetTransactionCheckParams =
  | GetTransactionCheckEthereumParams
  | GetTransactionCheckSolanaParams;

export type TransactionCheck = {
  publicKeyId: string;
  descriptor: string;
};

export interface TransactionCheckDataSource {
  getTransactionCheck(
    params: GetTransactionCheckParams,
  ): Promise<Either<Error, TransactionCheck>>;
}
