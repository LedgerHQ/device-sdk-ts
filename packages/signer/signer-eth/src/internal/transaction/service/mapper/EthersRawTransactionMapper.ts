import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { ethers, getBytes } from "ethers";
import { injectable } from "inversify";
import { Just, Maybe, Nothing } from "purify-ts";

import { TransactionMapperResult } from "./model/TransactionMapperResult";
import { TransactionMapper } from "./TransactionMapper";

@injectable()
export class EthersRawTransactionMapper implements TransactionMapper {
  map(transaction: Uint8Array): Maybe<TransactionMapperResult> {
    try {
      const tx = ethers.Transaction.from(bufferToHexaString(transaction));
      return Just({
        subset: {
          chainId: Number(tx.chainId.toString()),
          to: tx.to ?? undefined,
          data: tx.data,
        },
        serializedTransaction: getBytes(tx.unsignedSerialized),
        type: tx.type || 0,
      });
    } catch (_error) {
      return Nothing;
    }
  }
}
