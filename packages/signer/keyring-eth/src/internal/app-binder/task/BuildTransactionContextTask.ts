import {
  ClearSignContextSuccess,
  ContextModule,
} from "@ledgerhq/context-module";

import { Transaction, TransactionType } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type BuildTransactionTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[];
  readonly serializedTransaction: Uint8Array;
  readonly chainId: number;
  readonly transactionType: TransactionType;
};

export type BuildTransactionContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly mapper: TransactionMapperService;
  readonly transaction: Transaction;
  readonly options: TransactionOptions;
  readonly challenge: string;
};

export class BuildTransactionContextTask {
  constructor(private readonly args: BuildTransactionContextTaskArgs) {}

  async run(): Promise<BuildTransactionTaskResult> {
    const { contextModule, mapper, transaction, options, challenge } =
      this.args;
    const parsed = mapper.mapTransactionToSubset(transaction);
    parsed.ifLeft((err) => {
      throw err;
    });
    const { subset, serializedTransaction, type } = parsed.unsafeCoerce();

    const clearSignContexts = await contextModule.getContexts({
      challenge,
      domain: options.domain,
      ...subset,
    });

    // TODO: for now we ignore the error contexts
    // as we consider that they are warnings and not blocking
    const clearSignContextsSuccess: ClearSignContextSuccess[] =
      clearSignContexts.filter((context) => context.type !== "error");

    return {
      clearSignContexts: clearSignContextsSuccess,
      serializedTransaction,
      chainId: subset.chainId,
      transactionType: type,
    };
  }
}
