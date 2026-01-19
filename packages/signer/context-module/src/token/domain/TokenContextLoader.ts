import {
  HexaString,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
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

const SUPPORTED_TYPES: ClearSignContextType[] = [ClearSignContextType.TOKEN];

export type TokenContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
};

@injectable()
export class TokenContextLoader implements ContextLoader<TokenContextInput> {
  private _dataSource: TokenDataSource;
  private logger: LoggerPublisherService;

  constructor(
    @inject(tokenTypes.TokenDataSource) dataSource: TokenDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._dataSource = dataSource;
    this.logger = loggerFactory("TokenContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TokenContextInput {
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
      this.isSelectorSupported(input.selector) &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: TokenContextInput): Promise<ClearSignContext[]> {
    const { to, chainId } = input;

    const payload = await this._dataSource.getTokenInfosPayload({
      address: to,
      chainId,
    });

    const result = [
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

    this.logger.debug("load result", { data: { result } });
    return result;
  }

  private isSelectorSupported(selector: HexaString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
