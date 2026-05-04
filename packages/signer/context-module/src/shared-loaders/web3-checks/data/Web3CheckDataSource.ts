import { type Either } from "purify-ts";

export type Web3CheckParams = {
  path: string;
  body: unknown;
};

export type Web3CheckResult = {
  publicKeyId: string;
  descriptor: string;
};

export interface Web3CheckDataSource {
  check(params: Web3CheckParams): Promise<Either<Error, Web3CheckResult>>;
}
