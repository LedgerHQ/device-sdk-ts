import { HexaString, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  TransactionContext,
  TransactionFieldContext,
} from "@/shared/model/TransactionContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

export enum ERC20_SUPPORTED_SELECTORS {
  Approve = "0x095ea7b3",
  Transfer = "0xa9059cbb",
}

const SUPPORTED_SELECTORS: HexaString[] = Object.values(
  ERC20_SUPPORTED_SELECTORS,
);

@injectable()
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

    if (!isHexaString(selector)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ];
    }

    if (!this.isSelectorSupported(selector)) {
      return [];
    }

    const payload = await this._dataSource.getTokenInfosPayload({
      address: transaction.to,
      chainId: transaction.chainId,
    });

    return [
      payload.caseOf({
        Left: (error): ClearSignContext => ({
          type: ClearSignContextType.ERROR,
          error,
        }),
        Right: (value): ClearSignContext => ({
          type: ClearSignContextType.TOKEN,
          payload: value,
        }),
      }),
    ];
  }

  async loadField(
    field: TransactionFieldContext,
  ): Promise<ClearSignContext | null> {
    if (field.type !== ClearSignContextType.TOKEN) {
      return null;
    }
    const payload = await this._dataSource.getTokenInfosPayload({
      address: field.address,
      chainId: field.chainId,
    });
    return payload.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.TOKEN,
        payload: value,
      }),
    });
  }

  private isSelectorSupported(selector: HexaString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
