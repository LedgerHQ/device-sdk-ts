import { inject, injectable } from "inversify";
import { Either } from "purify-ts";

import { type SolanaDataSource } from "@/solana/data/SolanaDataSource";
import { solanaContextTypes } from "@/solana/di/solanaContextTypes";

import { SolanaContextLoader } from "./SolanaContextLoader";
import {
  SolanaTransactionContext,
  SolanaTransactionContextResult,
} from "./solanaContextTypes";

@injectable()
export class DefaultSolanaContextLoader implements SolanaContextLoader {
  private _dataSource: SolanaDataSource;

  constructor(
    @inject(solanaContextTypes.SolanaDataSource)
    dataSource: SolanaDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(
    SolanaContext: SolanaTransactionContext,
  ): Promise<Either<Error, SolanaTransactionContextResult>> {
    return await this._dataSource.getSolanaContext(SolanaContext);
  }
}
