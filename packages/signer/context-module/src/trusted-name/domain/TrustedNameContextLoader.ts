import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import type { TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";

export type TrustedNameContextInput = {
  chainId: number;
  domain: string;
  challenge: string;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.TRUSTED_NAME,
];

@injectable()
export class TrustedNameContextLoader
  implements ContextLoader<TrustedNameContextInput>
{
  private _dataSource: TrustedNameDataSource;

  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    dataSource: TrustedNameDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
  ) {
    this._dataSource = dataSource;
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TrustedNameContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      "domain" in input &&
      "challenge" in input &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      typeof input.chainId === "number" &&
      typeof input.domain === "string" &&
      input.domain.length > 0 &&
      typeof input.challenge === "string" &&
      input.challenge.length > 0 &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: TrustedNameContextInput): Promise<ClearSignContext[]> {
    const { chainId, domain, challenge, deviceModelId } = input;

    if (!this.isDomainValid(domain)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ];
    }

    const payload = await this._dataSource.getDomainNamePayload({
      chainId,
      domain,
      challenge,
    });
    const response = await payload.caseOf({
      Left: (error): Promise<ClearSignContext> =>
        Promise.resolve({
          type: ClearSignContextType.ERROR,
          error: error,
        }),
      Right: async ({ data, keyId, keyUsage }): Promise<ClearSignContext> => {
        const certificate = await this.certificateLoader.loadCertificate({
          keyId,
          keyUsage,
          targetDevice: deviceModelId,
        });
        return {
          type: ClearSignContextType.TRUSTED_NAME,
          payload: data,
          certificate,
        };
      },
    });

    return [response];
  }

  private isDomainValid(domain: string) {
    const lengthIsValid = domain.length > 0 && Number(domain.length) < 30;
    const containsOnlyValidChars = new RegExp("^[a-zA-Z0-9\\-\\_\\.]+$").test(
      domain,
    );

    return lengthIsValid && containsOnlyValidChars;
  }
}
