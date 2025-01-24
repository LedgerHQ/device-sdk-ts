import { inject, injectable } from "inversify";
import { Either, Left } from "purify-ts";

import { type Web3CheckDataSource } from "@/web3-check/data/Web3CheckDataSource";
import { web3CheckTypes } from "@/web3-check/di/web3CheckTypes";

import { Web3CheckContextLoader } from "./Web3CheckContextLoader";
import { Web3CheckContext, Web3Checks } from "./web3CheckTypes";

@injectable()
export class DefaultWeb3CheckContextLoader implements Web3CheckContextLoader {
  private _dataSource: Web3CheckDataSource;

  constructor(
    @inject(web3CheckTypes.Web3CheckDataSource)
    dataSource: Web3CheckDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(
    web3CheckContext: Web3CheckContext,
  ): Promise<Either<Error, Web3Checks>> {
    const { chainId, rawTx, from } = web3CheckContext;

    if (rawTx == undefined || typeof rawTx != "string") {
      return Left(
        new Error(
          "[ContextModule] Web3CheckContextLoader: cannot load web checks with undefined `rawTx` field params",
        ),
      );
    }

    if (from == undefined || typeof from != "string") {
      return Left(
        new Error(
          "[ContextModule] Web3CheckContextLoader: cannot load web checks with undefined `from` field params",
        ),
      );
    }

    // Handle descritor payload
    return await this._dataSource.getWeb3Checks({
      chainId: chainId,
      rawTx: rawTx,
      from: from,
    });
  }
}
