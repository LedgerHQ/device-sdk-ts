import { type Either, Left } from "purify-ts";

import {
  type GetTransactionCheckParams,
  type TransactionCheck,
} from "@/transaction-check/data/TransactionCheckDataSource";

/** Shape of the JSON body posted to Web3Checks `/{family}/scan/tx`. */
export type Web3ChecksScanRequestBody = {
  tx: { from: string; raw: string };
  chain?: number;
  domain?: string;
  block?: number;
};

/** Returned by each scan handler: the URL path and the request body for Web3Checks. */
export type ScanHandlerResult = {
  path: string;
  body: Web3ChecksScanRequestBody;
};

/**
 * Posts a JSON body to a Web3Checks tx scan path and maps the DTO to {@link TransactionCheck}.
 * Implemented by {@link HttpTransactionCheckDataSource._postScan}.
 */
export type PostTransactionCheckScan = (
  urlPath: string,
  data: Web3ChecksScanRequestBody,
) => Promise<Either<Error, TransactionCheck>>;

/**
 * Pairs a validator with a body-builder for a single `kind`.
 * The registry runs `validate` first; on success it passes the result to `buildBody`,
 * then feeds `{ path, body }` into `postScan`.
 */
export type TransactionCheckScanPipeline<
  K extends GetTransactionCheckParams["kind"],
  TValidated,
> = {
  validate: (
    params: Extract<GetTransactionCheckParams, { kind: K }>,
  ) => Either<Error, TValidated>;
  buildBody: (validated: TValidated) => ScanHandlerResult;
};

/**
 * Bound dispatch function returned by {@link createTransactionCheckScanPipeline}.
 * Encapsulates validate → buildBody → postScan for a single `kind`.
 */
export type BoundScanPipelineDispatcher<
  K extends GetTransactionCheckParams["kind"],
> = (
  params: Extract<GetTransactionCheckParams, { kind: K }>,
  postScan: PostTransactionCheckScan,
) => Promise<Either<Error, TransactionCheck>>;

/**
 * Type-checks that `validate`'s output matches `buildBody`'s input at definition
 * time, then returns a bound dispatcher that hides the intermediate `TValidated`.
 */
export function createTransactionCheckScanPipeline<
  K extends GetTransactionCheckParams["kind"],
  TValidated,
>(
  pipeline: TransactionCheckScanPipeline<K, TValidated>,
): BoundScanPipelineDispatcher<K> {
  return (params, postScan) => {
    const result = pipeline.validate(params);
    return result.caseOf({
      Left: (err) => Promise.resolve(Left<Error, TransactionCheck>(err)),
      Right: (validated) => {
        const { path, body } = pipeline.buildBody(validated);
        return postScan(path, body);
      },
    });
  };
}
