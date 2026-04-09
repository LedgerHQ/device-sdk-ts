import { type Either } from "purify-ts";

import {
  type GetTransactionCheckParams,
  type TransactionCheck,
} from "@/transaction-check/data/TransactionCheckDataSource";
import { validateEthereumTransactionCheckInput } from "@/transaction-check/input-validation/validateEthereumTransactionCheckInput";
import { validateSolanaTransactionCheckInput } from "@/transaction-check/input-validation/validateSolanaTransactionCheckInput";

import { ethereumTransactionCheckScanHandler } from "./ethereumTransactionCheckScanHandler";
import { solanaTransactionCheckScanHandler } from "./solanaTransactionCheckScanHandler";
import {
  type BoundScanPipelineDispatcher,
  type PostTransactionCheckScan,
  createTransactionCheckScanPipeline,
} from "./transactionCheckScanTypes";

/**
 * Per-`kind` scan pipeline: validate inputs, build POST body, call Web3Checks.
 * Adding a new `kind` to {@link GetTransactionCheckParams} without a pipeline here is a compile error.
 *
 * Each entry is created via {@link createTransactionCheckScanPipeline}, which
 * type-checks that `validate`'s output matches `buildBody`'s input at definition
 * time and returns an opaque dispatcher.
 */
const TRANSACTION_CHECK_SCAN_HANDLER_REGISTRY: {
  [K in GetTransactionCheckParams["kind"]]: BoundScanPipelineDispatcher<K>;
} = {
  ethereum: createTransactionCheckScanPipeline({
    validate: (params) =>
      validateEthereumTransactionCheckInput({
        from: params.from,
        rawTx: params.rawTx,
        chainId: params.chainId,
        domain: params.domain,
        block: params.block,
      }),
    buildBody: ethereumTransactionCheckScanHandler,
  }),
  solana: createTransactionCheckScanPipeline({
    validate: (params) =>
      validateSolanaTransactionCheckInput({
        from: params.from,
        rawTx: params.rawTx,
        chain: params.chain,
        domain: params.domain,
        block: params.block,
      }),
    buildBody: solanaTransactionCheckScanHandler,
  }),
};

export function dispatchTransactionCheckScanHandler<
  T extends GetTransactionCheckParams,
>(
  params: T,
  postScan: PostTransactionCheckScan,
): Promise<Either<Error, TransactionCheck>> {
  const handler = TRANSACTION_CHECK_SCAN_HANDLER_REGISTRY[params.kind] as (
    params: T,
    postScan: PostTransactionCheckScan,
  ) => Promise<Either<Error, TransactionCheck>>;
  return handler(params, postScan);
}
