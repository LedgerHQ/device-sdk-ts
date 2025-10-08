import { inject, injectable } from "inversify";

import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

export type TokenFieldInput = {
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

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is TokenFieldInput {
    return (
      expectedType === ClearSignContextType.TOKEN &&
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "address" in input
    );
  }

  async loadField(input: TokenFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getTokenInfosPayload({
      address: input.address,
      chainId: input.chainId,
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
