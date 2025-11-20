import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
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
  deviceModelId: DeviceModelId;
};

@injectable()
export class TokenContextFieldLoader
  implements ContextFieldLoader<TokenFieldInput>
{
  constructor(
    @inject(tokenTypes.TokenDataSource) private _dataSource: TokenDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
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
      "address" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined
    );
  }

  async loadField(input: TokenFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getTokenInfosPayload({
      address: input.address,
      chainId: input.chainId,
    });

    // Try to fetch the certificate if available
    const certificate = await this._certificateLoader.loadCertificate({
      keyId: KeyId.Erc20MetadataKey,
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: input.deviceModelId,
    });

    return payload.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.TOKEN,
        payload: value,
        certificate,
      }),
    });
  }
}
