import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { array, Codec, optional, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type SolanaTrustedNameDataSource } from "@/modules/solana/trusted-name/data/TrustedNameDataSource";
import { solanaTrustedNameTypes } from "@/modules/solana/trusted-name/di/trustedNameTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { loadChallengeBoundContexts } from "@/shared/utils/challengeBoundLoader";
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TRUSTED_NAME,
];

const NETWORK_DEFAULT = "mainnet";

/**
 * One trusted-name request, resolved to a Uint8Array TLV descriptor. The
 * caller must obtain a fresh challenge immediately before each fetch.
 */
export type SolanaTrustedNameRequest = {
  address: string;
  challenge: string;
  types: string[];
  sources: string[];
};

export type SolanaTrustedNameContextInput = {
  deviceModelId: DeviceModelId;
  network?: string; // "mainnet" | "devnet" | "testnet"; defaults to mainnet
  requests: SolanaTrustedNameRequest[];
};

const trustedNameRequestCodec = Codec.interface({
  address: string,
  challenge: string,
  types: array(string),
  sources: array(string),
});

const solanaTrustedNameInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  network: optional(string),
  requests: array(trustedNameRequestCodec),
});

@injectable()
export class SolanaTrustedNameContextLoader
  implements ContextLoader<SolanaTrustedNameContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(solanaTrustedNameTypes.SolanaTrustedNameDataSource)
    private readonly dataSource: SolanaTrustedNameDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaTrustedNameContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaTrustedNameContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaTrustedNameInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ requests }) =>
        requests.length > 0 &&
        requests.every((r) => r.address.length > 0 && r.challenge.length > 0),
    });
  }

  public async load(
    input: SolanaTrustedNameContextInput,
  ): Promise<ClearSignContext[]> {
    const network = input.network || NETWORK_DEFAULT;

    return loadChallengeBoundContexts({
      requests: input.requests,
      deviceModelId: input.deviceModelId,
      certificateLoader: this.certificateLoader,
      logger: this.logger,
      label: "TRUSTED_NAME",
      fetch: (request) =>
        this.dataSource.getTrustedName({
          address: request.address,
          challenge: request.challenge,
          types: request.types,
          sources: request.sources,
          network,
        }),
      toContext: (value, certificate) => ({
        type: ClearSignContextType.SOLANA_TRUSTED_NAME,
        payload: value.descriptor,
        certificate,
      }),
      describe: (request) => ({ address: request.address }),
    });
  }
}
