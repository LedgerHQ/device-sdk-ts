import { inject, injectable } from "inversify";

import * as NftDataSource from "@/nft/data/NftDataSource";
import { nftTypes } from "@/nft/di/nftTypes";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

type NftFieldInput = {
  chainId: number;
  address: string;
};

@injectable()
export class NftContextFieldLoader
  implements ContextFieldLoader<NftFieldInput>
{
  constructor(
    @inject(nftTypes.NftDataSource)
    private _dataSource: NftDataSource.NftDataSource,
  ) {}

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is NftFieldInput {
    return (
      expectedType === ClearSignContextType.NFT &&
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "address" in input
    );
  }

  async loadField(input: NftFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getNftInfosPayload({
      address: input.address,
      chainId: input.chainId,
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
