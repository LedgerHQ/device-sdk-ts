import { inject, injectable } from "inversify";

import { type TronTransactionContext } from "@/modules/tron/model/TronTransactionContext";
import { type TokenDataSource } from "@/modules/tron/token/data/TokenDataSource";
import { tokenTypes } from "@/modules/tron/token/di/tokenTypes";
import { parseTrc10AssetId } from "@/modules/tron/token/domain/parseTrc10AssetId";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRON_TOKEN,
];

@injectable()
export class TokenContextLoader
  implements ContextLoader<TronTransactionContext>
{
  constructor(
    @inject(tokenTypes.TokenDataSource)
    private readonly dataSource: TokenDataSource,
  ) {}

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TronTransactionContext {
    return (
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type)) &&
      typeof input === "object" &&
      input !== null &&
      "rawTransaction" in input &&
      input.rawTransaction instanceof Uint8Array &&
      input.rawTransaction.length > 0
    );
  }

  /**
   * A transaction carrying no TRC10 transfer yields no context rather than an
   * error: the device reviews it unchanged, which is the normal outcome for
   * every TRX and TRC20 transfer.
   */
  async load({
    rawTransaction,
  }: TronTransactionContext): Promise<ClearSignContext[]> {
    const assetId = parseTrc10AssetId(rawTransaction);
    if (assetId === undefined) return [];

    const payload = await this.dataSource.getTokenInfosPayload({ assetId });

    return payload.caseOf({
      Left: (error): ClearSignContext[] => [
        { type: ClearSignContextType.ERROR, error },
      ],
      Right: (value): ClearSignContext[] => [
        { type: ClearSignContextType.TRON_TOKEN, payload: value },
      ],
    });
  }
}
