import { isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";
import { transactionTypes } from "@/transaction/di/transactionTypes";

@injectable()
export class TransactionContextLoader implements ContextLoader {
  constructor(
    @inject(transactionTypes.TransactionDataSource)
    private transactionDataSource: TransactionDataSource,
  ) {}

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    if (!transaction.to || !transaction.data || transaction.data === "0x") {
      return [];
    }

    const selector = transaction.data.slice(0, 10);

    if (!isHexaString(selector)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ];
    }

    const result = await this.transactionDataSource.getTransactionDescriptors({
      address: transaction.to,
      chainId: transaction.chainId,
      selector,
    });

    return result.caseOf({
      Left: (error): ClearSignContext[] => [
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ],
      Right: (contexts): ClearSignContext[] => contexts,
    });
  }
}
