import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { ethers, getBytes } from "ethers";
import { injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { TransactionMapperResult } from "./model/TransactionMapperResult";
import { TransactionMapperService } from "./TransactionMapperService";

const SELECTOR_LENGTH = 10; // 0x prefix + 4 bytes for the selector

@injectable()
export class EthersTransactionMapperService
  implements TransactionMapperService
{
  constructor() {}

  mapTransactionToSubset(
    transaction: Uint8Array,
  ): Either<Error, TransactionMapperResult> {
    try {
      const tx = ethers.Transaction.from(bufferToHexaString(transaction));
      const chainId = Number(tx.chainId.toString());

      if (chainId <= 0) {
        return Left(new Error("Pre-EIP-155 transactions are not supported"));
      }

      return Right({
        subset: {
          chainId,
          to: tx.to ?? undefined,
          data: tx.data,
          selector:
            tx.data.length >= SELECTOR_LENGTH
              ? tx.data.slice(0, SELECTOR_LENGTH)
              : tx.data,
          value: tx.value,
        },
        serializedTransaction: getBytes(tx.unsignedSerialized),
        type: tx.type || 0,
      });
    } catch (_error) {
      return Left(new Error("Invalid transaction"));
    }
  }
}
