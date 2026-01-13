import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  SolanaContextTypes,
  SolanaLifiContextResult,
  SolanaTransactionDescriptorList,
} from "@/shared/model/SolanaContextTypes";
import { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "@/solanaLifi/data/SolanaLifiDataSource";
import { lifiTypes } from "@/solanaLifi/di/solanaLifiTypes";

type SolanaLifiFieldInput = SolanaTransactionContext & {
  templateId: string;
};

@injectable()
export class SolanaLifiContextLoader
  implements
    ContextFieldLoader<
      SolanaLifiFieldInput,
      SolanaContextTypes,
      SolanaLifiContextResult
    >
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(lifiTypes.SolanaLifiDataSource)
    private readonly dataSource: SolanaLifiDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaLifiContextLoader");
  }

  public canHandle(
    field: unknown,
    expectedType: SolanaContextTypes,
  ): field is SolanaLifiFieldInput {
    if (expectedType !== SolanaContextTypes.SOLANA_LIFI) return false;

    if (typeof field === "object" && field !== null && "templateId" in field) {
      const templateId = (field as { templateId: unknown }).templateId;
      return typeof templateId === "string" && templateId.length > 0;
    }

    return false;
  }

  public async loadField(
    solanaTokenContextInput: SolanaLifiFieldInput,
  ): Promise<SolanaLifiContextResult> {
    this.logger.debug("[loadField] Loading solana Lifi context", {
      data: { input: solanaTokenContextInput },
    });
    const { templateId } = solanaTokenContextInput;

    const payload = await this.dataSource.getTransactionDescriptorsPayload({
      templateId,
    });

    return payload.caseOf({
      Left: (error): SolanaLifiContextResult => {
        this.logger.error("[loadField] Error loading solana Lifi context", {
          data: { error },
        });

        return {
          type: SolanaContextTypes.ERROR,
          error,
        };
      },
      Right: (value): SolanaLifiContextResult => {
        this.logger.debug(
          "[loadField] Successfully loaded solana Lifi context",
          {
            data: { payload: this.pluckTransactionData(value) },
          },
        );

        return {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload: this.pluckTransactionData(value),
        };
      },
    });
  }

  private pluckTransactionData(
    tokenData: GetTransactionDescriptorsResponse,
  ): SolanaTransactionDescriptorList {
    return {
      ...tokenData.descriptors,
    };
  }
}
