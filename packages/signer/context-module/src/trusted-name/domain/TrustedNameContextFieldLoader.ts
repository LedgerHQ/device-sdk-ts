import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import * as TrustedNameDataSource from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

type TrustedNameFieldInput = {
  chainId: number;
  address: string;
  challenge: string;
  types: string[];
  sources: string[];
  deviceModelId: DeviceModelId;
};

@injectable()
export class TrustedNameContextFieldLoader
  implements ContextFieldLoader<TrustedNameFieldInput>
{
  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    private _dataSource: TrustedNameDataSource.TrustedNameDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
  ) {}

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType,
  ): input is TrustedNameFieldInput {
    return (
      expectedType === ClearSignContextType.TRUSTED_NAME &&
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "address" in input &&
      "challenge" in input &&
      "types" in input &&
      "sources" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined
    );
  }

  async loadField(input: TrustedNameFieldInput): Promise<ClearSignContext> {
    const payload = await this._dataSource.getTrustedNamePayload({
      chainId: input.chainId,
      address: input.address,
      challenge: input.challenge,
      types: input.types,
      sources: input.sources,
    });
    return await payload.caseOf({
      Left: (error): Promise<ClearSignContext> =>
        Promise.resolve({
          type: ClearSignContextType.ERROR,
          error,
        }),
      Right: async ({ data, keyId, keyUsage }): Promise<ClearSignContext> => {
        const certificate = await this._certificateLoader.loadCertificate({
          keyId,
          keyUsage,
          targetDevice: input.deviceModelId,
        });
        return {
          type: ClearSignContextType.TRUSTED_NAME,
          payload: data,
          certificate,
        };
      },
    });
  }
}
