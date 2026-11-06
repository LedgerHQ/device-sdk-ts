import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import * as NftDataSource from "@/modules/ethereum/nft/data/NftDataSource";
import { nftTypes } from "@/modules/ethereum/nft/di/nftTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

type NftFieldInput = {
  chainId: number;
  address: string;
  deviceModelId: DeviceModelId;
};

@injectable()
export class NftContextFieldLoader
  implements ContextFieldLoader<NftFieldInput>
{
  constructor(
    @inject(nftTypes.NftDataSource)
    private _dataSource: NftDataSource.NftDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is NftFieldInput {
    return (
      expectedType === ClearSignContextType.ETHEREUM_NFT &&
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "address" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined
    );
  }

  async loadField(input: NftFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getNftInfosPayload({
      address: input.address,
      chainId: input.chainId,
    });

    const certificate = await this._certificateLoader.loadCertificate({
      keyId: KeyId.NftMetadataKey,
      keyUsage: KeyUsage.NftMeta,
      targetDevice: input.deviceModelId,
    });

    return payload.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.ETHEREUM_NFT,
        payload: value,
        certificate,
      }),
    });
  }
}
