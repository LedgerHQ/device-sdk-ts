import { TransactionSubset } from "@ledgerhq/context-module";
import {
  BigNumber as EthersV5BitNumber,
  Transaction as EthersV5Transaction,
} from "ethers-v5";
import { Transaction as EthersV6Transaction } from "ethers-v6";
import { injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { Transaction } from "@api/index";

@injectable()
export class TransactionMapperService {
  constructor() {}

  mapTransactionToSubset(
    transaction: Transaction,
  ): Either<Error, TransactionSubset> {
    if (this.isEthersV5Transaction(transaction)) {
      return Right({
        chainId: transaction.chainId,
        to: transaction.to,
        data: transaction.data,
      });
    }

    if (this.isEthersV6Transaction(transaction)) {
      return Right({
        chainId: Number(transaction.chainId.toString()),
        to: transaction.to ?? undefined,
        data: transaction.data,
      });
    }

    // TODO: handle correctly with the future error type
    return Left(new Error("Unsupported transaction type"));
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
      tx.gasLimit instanceof EthersV5BitNumber &&
      (tx.gasPrice === undefined || tx.gasPrice instanceof EthersV5BitNumber) &&
      typeof tx.data === "string" &&
      tx.value instanceof EthersV5BitNumber &&
      typeof tx.chainId === "number" &&
      (tx.r === undefined || typeof tx.r === "string") &&
      (tx.s === undefined || typeof tx.s === "string") &&
      (tx.v === undefined || typeof tx.v === "number") &&
      (tx.type === undefined || typeof tx.type === "number") &&
      (tx.maxFeePerGas === undefined ||
        tx.maxFeePerGas instanceof EthersV5BitNumber) &&
      (tx.maxPriorityFeePerGas === undefined ||
        tx.maxPriorityFeePerGas instanceof EthersV5BitNumber)
    );
  }

  private isEthersV6Transaction(
    transaction: Transaction,
  ): transaction is EthersV6Transaction {
    return transaction instanceof EthersV6Transaction;
  }
}
