import { HexaString, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

export enum ERC20_SUPPORTED_SELECTORS {
  Approve = "0x095ea7b3",
  Transfer = "0xa9059cbb",
}

const SUPPORTED_SELECTORS: HexaString[] = Object.values(
  ERC20_SUPPORTED_SELECTORS,
);

export type TokenContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
};

@injectable()
export class TokenContextLoader implements ContextLoader<TokenContextInput> {
  private _dataSource: TokenDataSource;

  constructor(@inject(tokenTypes.TokenDataSource) dataSource: TokenDataSource) {
    this._dataSource = dataSource;
  }

  canHandle(input: unknown): input is TokenContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "to" in input &&
      "selector" in input &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      isHexaString(input.selector) &&
      this.isSelectorSupported(input.selector)
    );
  }

  async load(input: TokenContextInput): Promise<ClearSignContext[]> {
    const { to, chainId } = input;

    const payload = await this._dataSource.getTokenInfosPayload({
      address: to,
      chainId,
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

  private isSelectorSupported(selector: HexaString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
