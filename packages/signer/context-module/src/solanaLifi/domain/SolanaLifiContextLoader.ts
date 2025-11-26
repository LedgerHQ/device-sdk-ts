import { inject, injectable } from "inversify";

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

@injectable()
export class SolanaLifiContextLoader
  implements
    ContextFieldLoader<
      SolanaTransactionContext,
      SolanaContextTypes,
      SolanaLifiContextResult
    >
{
  constructor(
    @inject(lifiTypes.SolanaLifiDataSource)
    private readonly dataSource: SolanaLifiDataSource,
  ) {}

  public canHandle(
    field: unknown,
    _expectedType: SolanaContextTypes,
  ): field is SolanaTransactionContext {
    return (
      typeof field === "object" &&
      field !== null &&
      "templateId" in field &&
      !!(field as SolanaTransactionContext).templateId
    );
  }

  public async loadField(
    solanaTokenContextInput: SolanaTransactionContext,
  ): Promise<SolanaLifiContextResult> {
    const { templateId } = solanaTokenContextInput;

    if (!templateId) {
      return {
        type: SolanaContextTypes.ERROR,
        error: new Error(
          "[ContextModule] SolanaLifiContextLoader: templateId is missing",
        ),
      };
    }

    const payload = await this.dataSource.getTransactionDescriptorsPayload({
      templateId,
    });

    return payload.caseOf({
      Left: (error): SolanaLifiContextResult => ({
        type: SolanaContextTypes.ERROR,
        error,
      }),
      Right: (value): SolanaLifiContextResult => ({
        type: SolanaContextTypes.SOLANA_LIFI,
        payload: this.pluckTransactionData(value),
      }),
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
