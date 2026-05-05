import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/loaders/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/loaders/chain-agnostic/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/loaders/chain-agnostic/pki/model/KeyUsage";
import { PkiCertificate } from "@/loaders/chain-agnostic/pki/model/PkiCertificate";
import {
  type SolanaTokenDataSource,
  type TokenDataResponse,
} from "@/loaders/solana/token/data/SolanaTokenDataSource";
import { solanaTokenTypes } from "@/loaders/solana/token/di/solanaTokenTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  type SolanaContextError,
  type SolanaTokenContextSuccess,
  type SolanaTokenData,
} from "@/shared/model/SolanaContextTypes";
import { type SolanaTransactionContext } from "@/shared/model/SolanaTransactionContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TOKEN,
];

@injectable()
export class SolanaTokenContextLoader
  implements ContextLoader<SolanaTransactionContext>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(solanaTokenTypes.SolanaTokenDataSource)
    private readonly dataSource: SolanaTokenDataSource,
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaTokenContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaTransactionContext {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) {
      return false;
    }

    if (
      typeof input !== "object" ||
      input === null ||
      !("tokenInternalId" in input)
    ) {
      return false;
    }

    const tokenInternalId = (input as { tokenInternalId: unknown })
      .tokenInternalId;

    return typeof tokenInternalId === "string" && tokenInternalId.length > 0;
  }

  public async load(
    solanaTokenContextInput: SolanaTransactionContext,
  ): Promise<ClearSignContext[]> {
    this.logger.debug("[load] Loading solana token context", {
      data: { input: solanaTokenContextInput },
    });
    const result = await this._loadInternal(solanaTokenContextInput);
    if (result.type === ClearSignContextType.ERROR) {
      return [{ type: ClearSignContextType.ERROR, error: result.error }];
    }
    const r = result as SolanaTokenContextSuccess;
    return [
      {
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: r.payload,
        certificate: r.certificate,
      },
    ];
  }

  private async _loadInternal(
    solanaTokenContextInput: SolanaTransactionContext,
  ): Promise<SolanaTokenContextSuccess | SolanaContextError> {
    const { tokenInternalId, deviceModelId } = solanaTokenContextInput;

    if (!tokenInternalId) {
      return {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] SolanaTokenContextLoader: tokenInternalId is missing",
        ),
      };
    }

    const payload = await this.dataSource.getTokenInfosPayload({
      tokenInternalId,
    });

    const certificate: PkiCertificate | undefined =
      await this._certificateLoader.loadCertificate({
        keyId: "token_metadata_key",
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: deviceModelId,
      });

    if (!certificate) {
      return {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] SolanaTokenContextLoader: tokenMetadataCertificate is missing",
        ),
      };
    }

    return payload.caseOf({
      Left: (error): SolanaTokenContextSuccess | SolanaContextError => {
        this.logger.error(
          "[_loadInternal] Error loading solana token context",
          {
            data: { error },
          },
        );

        return {
          type: ClearSignContextType.ERROR,
          error,
        };
      },
      Right: (value): SolanaTokenContextSuccess | SolanaContextError => {
        this.logger.debug(
          "[_loadInternal] Successfully loaded solana token context",
          {
            data: { payload: this.pluckTokenData(value), certificate },
          },
        );

        return {
          type: ClearSignContextType.SOLANA_TOKEN,
          payload: this.pluckTokenData(value),
          certificate,
        };
      },
    });
  }

  private pluckTokenData(tokenData: TokenDataResponse): SolanaTokenData {
    const signatureKind = this.config.cal.mode || "prod";
    return {
      solanaTokenDescriptor: {
        data: tokenData.descriptor.data,
        signature: tokenData.descriptor.signatures[signatureKind],
      },
    };
  }
}
