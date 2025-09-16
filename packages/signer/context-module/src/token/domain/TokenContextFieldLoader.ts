import { inject, injectable } from "inversify";

import {
  type ContextFieldLoader,
  ContextFieldLoaderKind,
} from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

export type TokenFieldInput = {
  kind: ContextFieldLoaderKind.TOKEN;
  chainId: number;
  address: string;
};

@injectable()
export class TokenContextFieldLoader
  implements ContextFieldLoader<TokenFieldInput>
{
  constructor(
    @inject(tokenTypes.TokenDataSource) private _dataSource: TokenDataSource,
  ) {}

  canHandle(input: unknown): input is TokenFieldInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "kind" in input &&
      input.kind === ContextFieldLoaderKind.TOKEN &&
      "chainId" in input &&
      "address" in input
    );
  }

  async loadField(field: TokenFieldInput): Promise<ClearSignContext> {
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
