import {
  BigNumber,
  ethers,
  Transaction as EthersV5Transaction,
} from "ethers-v5";
import { injectable } from "inversify";
import { Just, Maybe, Nothing } from "purify-ts";

import { Transaction } from "@api/index";

import { TransactionMapperResult } from "./model/TransactionMapperResult";
import { TransactionMapper } from "./TransactionMapper";

@injectable()
export class EthersV5TransactionMapper implements TransactionMapper {
  constructor() {}

  map(transaction: Transaction): Maybe<TransactionMapperResult> {
    if (this.isEthersV5Transaction(transaction)) {
      // ensure that we have a valid non signed transaction
      const txUnsigned = {
        to: transaction.to,
        nonce: transaction.nonce,
        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,
        data: transaction.data,
        value: transaction.value,
        chainId: transaction.chainId,
      };
      const serializedTransaction = ethers.utils.arrayify(
        ethers.utils.serializeTransaction(txUnsigned),
      );

      return Just({
        subset: {
          chainId: transaction.chainId,
          to: transaction.to,
          data: transaction.data,
        },
        serializedTransaction,
        type: transaction.type || 0,
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
      typeof tx.nonce === "number" &&
      tx.gasLimit instanceof BigNumber &&
      (tx.gasPrice === undefined || tx.gasPrice instanceof BigNumber) &&
      typeof tx.data === "string" &&
      tx.value instanceof BigNumber &&
      typeof tx.chainId === "number" &&
      (tx.type === undefined || typeof tx.type === "number")
    );
  }
}
