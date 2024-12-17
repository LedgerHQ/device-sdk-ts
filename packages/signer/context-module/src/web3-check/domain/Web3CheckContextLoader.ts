import { type Either } from "purify-ts";

import { type Web3CheckContext, type Web3Checks } from "./web3CheckTypes";

export interface Web3CheckContextLoader {
  load(web3CheckContext: Web3CheckContext): Promise<Either<Error, Web3Checks>>;
}
