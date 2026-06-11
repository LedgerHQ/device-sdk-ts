import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import {
  type SolanaContextError,
  type SolanaTokenContextSuccess,
} from "@/modules/solana/model/SolanaContextTypes";
import { type SolanaTokenData } from "@/modules/solana/model/SolanaPayloads";
import { type SolanaTransactionContext } from "@/modules/solana/model/SolanaTransactionContext";
import {
  type TokenDataResponse,
  type TokenDataSource,
} from "@/modules/solana/token/data/TokenDataSource";
import { tokenTypes } from "@/modules/solana/token/di/tokenTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TOKEN,
];

@injectable()
export class TokenContextLoader
  implements ContextLoader<SolanaTransactionContext>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(tokenTypes.TokenDataSource)
    private readonly dataSource: TokenDataSource,
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("TokenContextLoader");
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
          "[ContextModule] TokenContextLoader: tokenInternalId is missing",
        ),
      };
    }

    const payload = await this.dataSource.getTokenInfosPayload({
      tokenInternalId,
    });

    const certificate: PkiCertificate | undefined =
      await this._certificateLoader.loadCertificate({
        keyId: KeyId.TokenMetadataKey,
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: deviceModelId,
      });

    if (!certificate) {
      return {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] TokenContextLoader: tokenMetadataCertificate is missing",
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
