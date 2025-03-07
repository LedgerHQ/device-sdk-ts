import { type Either } from "purify-ts";

import type {
  Web3CheckContext,
  Web3Checks,
} from "@/web3-check/domain/web3CheckTypes";

export interface Web3CheckDataSource {
  getWeb3Checks(params: Web3CheckContext): Promise<Either<Error, Web3Checks>>;
}
