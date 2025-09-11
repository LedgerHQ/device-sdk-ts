import { type Either } from "purify-ts";

export type GetTransactionCheckParams = {
  chainId: number;
  rawTx: string;
  from: string;
};

export type TransactionCheck = {
  publicKeyId: string;
  descriptor: string;
};

export interface TransactionCheckDataSource {
  getTransactionCheck(
    params: GetTransactionCheckParams,
  ): Promise<Either<Error, TransactionCheck>>;
}
