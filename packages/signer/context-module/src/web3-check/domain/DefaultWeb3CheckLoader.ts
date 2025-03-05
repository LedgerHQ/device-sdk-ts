import { inject, injectable } from "inversify";
import { Either } from "purify-ts";

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
    return await this._dataSource.getWeb3Checks(web3CheckContext);
  }
}
