import { TransactionSubset } from "@ledgerhq/context-module";
import { BigNumber, Transaction as EthersV5Transaction } from "ethers-v5";
import { injectable } from "inversify";
import { Just, Maybe, Nothing } from "purify-ts";

import { Transaction } from "@api/index";

import { TransactionMapper } from "./TransactionMapper";

@injectable()
export class EthersV5TransactionMapper implements TransactionMapper {
  constructor() {}

  map(transaction: Transaction): Maybe<TransactionSubset> {
    if (this.isEthersV5Transaction(transaction)) {
      return Just({
        chainId: transaction.chainId,
        to: transaction.to,
        data: transaction.data,
      });
    }

    return Nothing;
  }

  private isEthersV5Transaction(
    transaction: Transaction,
  ): transaction is EthersV5Transaction {
    const tx = transaction as EthersV5Transaction;
    return (
      typeof tx === "object" &&
      tx !== null &&
      (tx.to === undefined || typeof tx.to === "string") &&
      (tx.from === undefined || typeof tx.from === "string") &&
      typeof tx.nonce === "number" &&
      tx.gasLimit instanceof BigNumber &&
      (tx.gasPrice === undefined || tx.gasPrice instanceof BigNumber) &&
      typeof tx.data === "string" &&
      tx.value instanceof BigNumber &&
      typeof tx.chainId === "number" &&
      (tx.r === undefined || typeof tx.r === "string") &&
      (tx.s === undefined || typeof tx.s === "string") &&
      (tx.v === undefined || typeof tx.v === "number") &&
      (tx.type === undefined || typeof tx.type === "number") &&
      (tx.maxFeePerGas === undefined || tx.maxFeePerGas instanceof BigNumber) &&
      (tx.maxPriorityFeePerGas === undefined ||
        tx.maxPriorityFeePerGas instanceof BigNumber)
    );
  }
}
