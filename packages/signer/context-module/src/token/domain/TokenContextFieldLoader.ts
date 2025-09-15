import { inject, injectable } from "inversify";

import {
  type ContextFieldLoader,
  ContextFieldLoaderKind,
} from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type TransactionFieldContext } from "@/shared/model/TransactionFieldContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

@injectable()
export class TokenContextFieldLoader
  implements ContextFieldLoader<ContextFieldLoaderKind.TOKEN>
{
  kind: ContextFieldLoaderKind.TOKEN = ContextFieldLoaderKind.TOKEN;

  constructor(
    @inject(tokenTypes.TokenDataSource) private _dataSource: TokenDataSource,
  ) {}

  async loadField(
    field: TransactionFieldContext<ContextFieldLoaderKind.TOKEN>,
  ): Promise<ClearSignContext> {
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
}
