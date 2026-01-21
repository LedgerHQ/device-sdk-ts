import {
  DeviceModelId,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
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
  to: string;
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
  private logger: LoggerPublisherService;

  constructor(
    @inject(trustedNameTypes.TrustedNameDataSource)
    private _dataSource: TrustedNameDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private _certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("TrustedNameContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is TrustedNameContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "chainId" in input &&
      input.chainId !== undefined &&
      typeof input.chainId === "number" &&
      "to" in input &&
      input.to !== undefined &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      "challenge" in input &&
      typeof input.challenge === "string" &&
      input.challenge.length > 0 &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: TrustedNameContextInput): Promise<ClearSignContext[]> {
    const payload = await this._dataSource.getTrustedNamePayload({
      chainId: input.chainId,
      address: input.to,
      challenge: input.challenge,
      types: ["eoa"],
      sources: ["ens"],
    });

    this.logger.debug("[ContextModule]: load result", { data: { payload } });

    return await payload.caseOf({
      Left: (error): Promise<ClearSignContext[]> =>
        Promise.resolve([{ type: ClearSignContextType.ERROR, error }]),
      Right: async ({ data, keyId, keyUsage }): Promise<ClearSignContext[]> => {
        const certificate = await this._certificateLoader.loadCertificate({
          keyId,
          keyUsage,
          targetDevice: input.deviceModelId,
        });
        return [
          {
            type: ClearSignContextType.TRUSTED_NAME,
            payload: data,
            certificate,
          },
        ];
      },
    });
  }
}
