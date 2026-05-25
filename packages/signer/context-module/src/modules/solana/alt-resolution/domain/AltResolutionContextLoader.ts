import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { array, Codec, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type AltResolutionDataSource } from "@/modules/solana/alt-resolution/data/AltResolutionDataSource";
import { altResolutionTypes } from "@/modules/solana/alt-resolution/di/altResolutionTypes";
import { type SolanaAltResolutionPayload } from "@/modules/solana/model/SolanaPayloads";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { loadChallengeBoundContexts } from "@/shared/utils/challengeBoundLoader";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";
import { u8Codec } from "@/shared/utils/uIntCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_ALT_RESOLUTION,
];

export type SolanaAltResolutionRequest = {
  altAddress: string;
  entryIndex: number;
  challenge: string;
};

export type SolanaAltResolutionContextInput = {
  deviceModelId: DeviceModelId;
  requests: SolanaAltResolutionRequest[];
};

const altResolutionRequestCodec = Codec.interface({
  altAddress: string,
  entryIndex: u8Codec,
  challenge: string,
});

const solanaAltResolutionInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  requests: array(altResolutionRequestCodec),
});

@injectable()
export class AltResolutionContextLoader
  implements ContextLoader<SolanaAltResolutionContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(altResolutionTypes.AltResolutionDataSource)
    private readonly dataSource: AltResolutionDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("AltResolutionContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaAltResolutionContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaAltResolutionInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ requests }) =>
        requests.length > 0 &&
        requests.every(
          (r) => r.altAddress.length > 0 && r.challenge.length > 0,
        ),
    });
  }

  public async load(
    input: SolanaAltResolutionContextInput,
  ): Promise<ClearSignContext[]> {
    return loadChallengeBoundContexts({
      requests: input.requests,
      deviceModelId: input.deviceModelId,
      certificateLoader: this.certificateLoader,
      logger: this.logger,
      label: "ALT_RESOLUTION",
      fetch: (request) => this.dataSource.getAltResolution(request),
      toContext: (value, certificate) => {
        const payload: SolanaAltResolutionPayload = {
          descriptor: value.descriptor,
        };
        return {
          type: ClearSignContextType.SOLANA_ALT_RESOLUTION,
          payload,
          certificate,
        };
      },
      describe: (request) => ({
        altAddress: request.altAddress,
        entryIndex: request.entryIndex,
      }),
    });
  }
}
