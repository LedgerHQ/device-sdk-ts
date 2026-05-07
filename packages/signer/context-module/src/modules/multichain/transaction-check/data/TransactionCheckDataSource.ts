import { type Either } from "purify-ts";

export type TransactionCheckParams = {
  path: string;
  body: unknown;
};

export type TransactionCheckResult = {
  publicKeyId: string;
  descriptor: string;
};

export interface TransactionCheckDataSource {
  check(
    params: TransactionCheckParams,
  ): Promise<Either<Error, TransactionCheckResult>>;
}
