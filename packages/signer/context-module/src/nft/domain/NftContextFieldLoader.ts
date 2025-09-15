import { inject, injectable } from "inversify";

import * as NftDataSource from "@/nft/data/NftDataSource";
import { nftTypes } from "@/nft/di/nftTypes";
import {
  type ContextFieldLoader,
  ContextFieldLoaderKind,
} from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type TransactionFieldContext } from "@/shared/model/TransactionFieldContext";

@injectable()
export class NftContextFieldLoader
  implements ContextFieldLoader<ContextFieldLoaderKind.NFT>
{
  kind: ContextFieldLoaderKind.NFT = ContextFieldLoaderKind.NFT;

  constructor(
    @inject(nftTypes.NftDataSource)
    private _dataSource: NftDataSource.NftDataSource,
  ) {}

  async loadField(
    field: TransactionFieldContext<ContextFieldLoaderKind.NFT>,
  ): Promise<ClearSignContext> {
    const payload = await this._dataSource.getNftInfosPayload({
      address: field.address,
      chainId: field.chainId,
    });
    return payload.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.NFT,
        payload: value,
      }),
    });
  }
}
