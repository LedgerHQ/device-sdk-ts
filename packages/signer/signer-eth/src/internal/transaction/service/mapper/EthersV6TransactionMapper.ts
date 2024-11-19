import {
  BigNumberish,
  getBytes,
  Transaction as EthersV6Transaction,
} from "ethers-v6";
import { injectable } from "inversify";
import { Just, Maybe, Nothing } from "purify-ts";

import { Transaction } from "@api/model/Transaction";

import { TransactionMapperResult } from "./model/TransactionMapperResult";
import { TransactionMapper } from "./TransactionMapper";

@injectable()
export class EthersV6TransactionMapper implements TransactionMapper {
  map(transaction: Transaction): Maybe<TransactionMapperResult> {
    if (this.isEthersV6Transaction(transaction)) {
      const serializedTransaction = getBytes(transaction.unsignedSerialized);
      return Just({
        subset: {
          chainId: Number(transaction.chainId.toString()),
          to: transaction.to ?? undefined,
          data: transaction.data,
        },
        serializedTransaction,
        type: transaction.type || 0,
      });
    }

    return Nothing;
  }

  private isEthersV6Transaction(
    transaction: Transaction,
  ): transaction is EthersV6Transaction {
    return (
      typeof transaction === "object" &&
      (transaction.hash === null || typeof transaction.hash === "string") &&
      (transaction.to === null || typeof transaction.to === "string") &&
      (transaction.gasLimit == null || isBigNumberish(transaction.gasLimit)) &&
      (transaction.gasPrice === null || isBigNumberish(transaction.gasPrice)) &&
      (transaction.value === null || isBigNumberish(transaction.value)) &&
      (transaction.chainId === null ||
        isBigNumberish(typeof transaction.chainId)) &&
      (transaction.type === null || typeof transaction.type === "number")
    );
  }
}

const isBigNumberish = (number: unknown): number is BigNumberish =>
  typeof number === "string" ||
  typeof number === "number" ||
  typeof number === "bigint";
