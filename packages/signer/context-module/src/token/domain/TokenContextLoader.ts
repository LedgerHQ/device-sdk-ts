import { inject } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import { ClearSignContext } from "@/shared/model/ClearSignContext";
import { HexString, isHexString } from "@/shared/model/HexString";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

export enum ERC20_SUPPORTED_SELECTORS {
  Approve = "0x095ea7b3",
  Transfer = "0xa9059cbb",
}

const SUPPORTED_SELECTORS: HexString[] = Object.values(
  ERC20_SUPPORTED_SELECTORS,
);

export class TokenContextLoader implements ContextLoader {
  private _dataSource: TokenDataSource;

  constructor(@inject(tokenTypes.TokenDataSource) dataSource: TokenDataSource) {
    this._dataSource = dataSource;
  }

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    if (!transaction.to || !transaction.data || transaction.data === "0x") {
      return [];
    }

    const selector = transaction.data.slice(0, 10);

    if (!isHexString(selector)) {
      return [{ type: "error", error: new Error("Invalid selector") }];
    }

    if (!this.isSelectorSupported(selector)) {
      return [];
    }

    const payload = await this._dataSource.getTokenInfosPayload({
      address: transaction.to,
      chainId: transaction.chainId,
    });

    return payload.caseOf({
      Left: (error): ClearSignContext[] => [
        {
          type: "error",
          error,
        },
      ],
      Right: (value): ClearSignContext[] => {
        if (!value) {
          return [];
        }

        return [{ type: "provideERC20TokenInformation", payload: value }];
      },
    });
  }

  private isSelectorSupported(selector: HexString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
