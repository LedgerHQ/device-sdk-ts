import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  SolanaContextTypes,
  SolanaLifiContextResult,
  type SolanaLifiInstructionMeta,
  type SolanaLifiPayload,
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
    if (expectedType !== SolanaContextTypes.SOLANA_LIFI) {
      this.logger.debug("[canHandle] Skipping, expected type does not match", {
        data: { expectedType, required: SolanaContextTypes.SOLANA_LIFI },
      });
      return false;
    }

    if (typeof field === "object" && field !== null && "templateId" in field) {
      const templateId = (field as { templateId: unknown }).templateId;
      const isValid = typeof templateId === "string" && templateId.length > 0;
      this.logger.debug("[canHandle] Field validation result", {
        data: { templateId, isValid },
      });
      return isValid;
    }

    this.logger.debug("[canHandle] Field does not contain a valid templateId", {
      data: { field },
    });
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
        const payload = this.buildPayload(value);
        this.logger.debug(
          "[loadField] Successfully loaded solana Lifi context",
          {
            data: {
              descriptors: payload.descriptors,
              instructionsCount: payload.instructions.length,
            },
          },
        );

        return {
          type: SolanaContextTypes.SOLANA_LIFI,
          payload,
        };
      },
    });
  }

  private buildPayload(
    response: GetTransactionDescriptorsResponse,
  ): SolanaLifiPayload {
    return {
      descriptors: this.pluckTransactionData(response),
      instructions: this.extractInstructionsMeta(response),
    };
  }

  private pluckTransactionData(
    tokenData: GetTransactionDescriptorsResponse,
  ): SolanaTransactionDescriptorList {
    const output: SolanaTransactionDescriptorList = {};
    const descriptors = tokenData.descriptors ?? [];

    this.logger.debug("[pluckTransactionData] Processing descriptors", {
      data: { descriptorsCount: descriptors.length },
    });

    for (const item of descriptors) {
      const key = `${item.program_id}:${item.discriminator_hex ?? "0"}`;
      output[key] = item.descriptor;
      this.logger.debug("[pluckTransactionData] Mapped program descriptor", {
        data: {
          programId: item.program_id,
          discriminatorHex: item.discriminator_hex ?? "0",
          key,
        },
      });
    }

    this.logger.debug("[pluckTransactionData] Completed processing", {
      data: { outputKeys: Object.keys(output) },
    });

    return output;
  }

  private extractInstructionsMeta(
    response: GetTransactionDescriptorsResponse,
  ): SolanaLifiInstructionMeta[] {
    const instructions = response.instructions ?? [];

    this.logger.debug(
      "[extractInstructionsMeta] Extracting instructions metadata",
      {
        data: { instructionsCount: instructions.length },
      },
    );

    const meta = instructions.map((ix) => ({
      program_id: ix.program_id,
      ...(ix.discriminator_hex !== undefined && {
        discriminator_hex: ix.discriminator_hex,
      }),
    }));

    this.logger.debug(
      "[extractInstructionsMeta] Completed extracting instructions metadata",
      {
        data: {
          meta: meta.map((m) => ({
            programId: m.program_id,
            discriminatorHex: m.discriminator_hex,
          })),
        },
      },
    );

    return meta;
  }
}
