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

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    const { to, data, selector, chainId, deviceModelId } = ctx;
    if (to === undefined || data === "0x") {
      return [];
    }

    if (!isHexaString(selector)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ];
    }

    const result = await this.transactionDataSource.getTransactionDescriptors({
      deviceModelId,
      address: to,
      chainId,
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
