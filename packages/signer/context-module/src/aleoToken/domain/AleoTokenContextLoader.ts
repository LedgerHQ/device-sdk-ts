import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  AleoContextTypes,
  type AleoTokenContextResult,
} from "@/shared/model/AleoContextTypes";
import { type AleoTransactionContext } from "@/shared/model/AleoTransactionContext";
import {
  type AleoTokenDataSource,
} from "@/aleoToken/data/AleoTokenDataSource";
import { aleoTokenTypes } from "@/aleoToken/di/aleoTokenTypes";

@injectable()
export class AleoTokenContextLoader
  implements
    ContextFieldLoader<
      AleoTransactionContext,
      AleoContextTypes,
      AleoTokenContextResult
    >
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(aleoTokenTypes.AleoTokenDataSource)
    private readonly dataSource: AleoTokenDataSource,
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly _certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("AleoTokenContextLoader");
  }

  public canHandle(
    field: unknown,
    expectedType: AleoContextTypes,
  ): field is AleoTransactionContext {
    if (expectedType !== AleoContextTypes.ALEO_TOKEN) {
      return false;
    }

    if (
      typeof field !== "object" ||
      field === null ||
      !("tokenInternalId" in field)
    ) {
      return false;
    }

    const tokenInternalId = (field as { tokenInternalId: unknown })
      .tokenInternalId;

    return typeof tokenInternalId === "string" && tokenInternalId.length > 0;
  }

  public async loadField(
    aleoTokenContextInput: AleoTransactionContext,
  ): Promise<AleoTokenContextResult> {
    this.logger.debug("[loadField] Loading aleo token context", {
      data: { input: aleoTokenContextInput },
    });
    const { tokenInternalId, programName, deviceModelId } = aleoTokenContextInput;

    const payload = await this.dataSource.getTokenInfosPayload({
      tokenInternalId,
      programName,
    });

    const certificate = await this._certificateLoader.loadCertificate({
      keyId: "token_metadata_key",
      keyUsage: KeyUsage.CoinMeta,
      targetDevice: deviceModelId,
    });

    return payload.caseOf({
      Left: (error): AleoTokenContextResult => {
        this.logger.error("[loadField] Error loading aleo token context", {
          data: { error },
        });
        return {
          type: AleoContextTypes.ERROR,
          error,
        };
      },
      Right: (value): AleoTokenContextResult => {
        const signatureKind = this.config.cal.mode || "prod";
        this.logger.debug(
          "[loadField] Successfully loaded aleo token context",
          { data: { certificate } },
        );
        return {
          type: AleoContextTypes.ALEO_TOKEN,
          payload: {
            aleoTokenDescriptor: {
              data: value.descriptor.data,
              signature: value.descriptor.signatures[signatureKind],
            },
          },
          certificate,
        };
      },
    });
  }
}
