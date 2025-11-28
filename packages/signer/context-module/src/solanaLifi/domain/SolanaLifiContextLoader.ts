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
  constructor(
    @inject(lifiTypes.SolanaLifiDataSource)
    private readonly dataSource: SolanaLifiDataSource,
  ) {}

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
    const { templateId } = solanaTokenContextInput;

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
