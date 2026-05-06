import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/chain-agnostic/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/modules/chain-agnostic/pki/model/KeyUsage";
import { type SolanaDataSource } from "@/modules/solana/owner-info/data/SolanaDataSource";
import { solanaContextTypes } from "@/modules/solana/owner-info/di/solanaContextTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { type SolanaTransactionContext } from "@/shared/model/SolanaTransactionContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TRUSTED_NAME,
];

@injectable()
export class SolanaOwnerInfoContextLoader
  implements ContextLoader<SolanaTransactionContext>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(solanaContextTypes.SolanaDataSource)
    private readonly _dataSource: SolanaDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaOwnerInfoContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaTransactionContext {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) {
      return false;
    }
    if (typeof input !== "object" || input === null) {
      return false;
    }
    const ctx = input as Partial<SolanaTransactionContext>;
    return !!(ctx.tokenAddress || ctx.createATA);
  }

  public async load(
    solanaContext: SolanaTransactionContext,
  ): Promise<ClearSignContext[]> {
    this.logger.debug("[load] Loading solana owner info context", {
      data: { input: solanaContext },
    });

    const { deviceModelId } = solanaContext;

    const trustedNamePKICertificate =
      await this._certificateLoader.loadCertificate({
        keyId: "domain_metadata_key",
        keyUsage: KeyUsage.TrustedName,
        targetDevice: deviceModelId,
      });

    if (!trustedNamePKICertificate) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] SolanaOwnerInfoContextLoader: trustedNamePKICertificate is missing",
          ),
        },
      ];
    }

    const tlvDescriptorEither =
      await this._dataSource.getOwnerInfo(solanaContext);

    return tlvDescriptorEither.caseOf({
      Left: (error): ClearSignContext[] => [
        { type: ClearSignContextType.ERROR, error },
      ],
      Right: ({ tlvDescriptor }): ClearSignContext[] => {
        if (tlvDescriptor !== undefined) {
          return [
            {
              type: ClearSignContextType.SOLANA_TRUSTED_NAME,
              payload: tlvDescriptor,
              certificate: trustedNamePKICertificate,
            },
          ];
        }
        return [];
      },
    });
  }
}
