import {
  ClearSignContextSuccess,
  ContextModule,
} from "@ledgerhq/context-module";

import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type BuildTransactionTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[];
  readonly serializedTransaction: Uint8Array;
};

export class BuildTransactionContextTask {
  constructor(
    private contextModule: ContextModule,
    private mapper: TransactionMapperService,
    private transaction: Transaction,
    private options: TransactionOptions,
    private challenge: string,
  ) {}

  async run(): Promise<BuildTransactionTaskResult> {
    const parsed = this.mapper.mapTransactionToSubset(this.transaction);
    parsed.ifLeft((err) => {
      throw err;
    });
    const { subset, serializedTransaction } = parsed.unsafeCoerce();

    const clearSignContexts = await this.contextModule.getContexts({
      challenge: this.challenge,
      domain: this.options.domain,
      ...subset,
    });

    // TODO: for now we ignore the error contexts
    // as we consider that they are warnings and not blocking
    const clearSignContextsSuccess: ClearSignContextSuccess[] =
      clearSignContexts.filter((context) => context.type !== "error");

    return {
      clearSignContexts: clearSignContextsSuccess,
      serializedTransaction,
    };
  }
}
