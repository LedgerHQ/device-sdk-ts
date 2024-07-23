import { TransactionSubset } from "@ledgerhq/context-module";
import { Transaction as EthersV6Transaction } from "ethers-v6";
import { injectable } from "inversify";
import { Just, Maybe, Nothing } from "purify-ts";

import { Transaction } from "@api/index";

import { TransactionMapper } from "./TransactionMapper";

@injectable()
export class EthersV6TransactionMapper implements TransactionMapper {
  map(transaction: Transaction): Maybe<TransactionSubset> {
    if (this.isEthersV6Transaction(transaction)) {
      return Just({
        chainId: Number(transaction.chainId.toString()),
        to: transaction.to ?? undefined,
        data: transaction.data,
      });
    }

    return Nothing;
  }

  private isEthersV6Transaction(
    transaction: Transaction,
  ): transaction is EthersV6Transaction {
    return transaction instanceof EthersV6Transaction;
  }
}
