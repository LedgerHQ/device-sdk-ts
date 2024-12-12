import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import { type Web3CheckDataSource } from "@/web3-check/datasource/Web3CheckDataSource";
import { web3CheckTypes } from "@/web3-check/di/web3CheckTypes";

@injectable()
export class Web3CheckContextLoader implements ContextLoader {
  private _dataSource: Web3CheckDataSource;

  constructor(
    @inject(web3CheckTypes.Web3CheckDataSource)
    dataSource: Web3CheckDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(
    transactionContext: TransactionContext,
  ): Promise<ClearSignContext[]> {
    const { chainId, rawTx, from } = transactionContext;

    if (rawTx == undefined || typeof rawTx != "string") {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] Web3CheckContextLoader: cannot load web checks with undefined `rawTx` field params",
          ),
        },
      ];
    }

    if (from == undefined || typeof from != "string") {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] Web3CheckContextLoader: cannot load web checks with undefined `from` field params",
          ),
        },
      ];
    }

    const payload = await this._dataSource.getWeb3Checks({
      chainId: chainId,
      rawTx: rawTx,
      from: from,
    });

    //Check Certificate here ?
    let certificate: string? = undefined;

    return [
      payload.caseOf({
        Left: (error): ClearSignContext => ({
          type: ClearSignContextType.ERROR,
          error: error,
        }),
        Right: (value): ClearSignContext => ({
          type: ClearSignContextType.TRUSTED_NAME,
          payload: value,
          certificate: certificate,
        }),
      }),
    ];
  }
}
