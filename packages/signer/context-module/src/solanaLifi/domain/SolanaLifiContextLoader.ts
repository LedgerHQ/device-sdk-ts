import { inject, injectable } from "inversify";

import { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "@/solanaLifi/data/SolanaLifiDataSource";
import { lifiTypes } from "@/solanaLifi/di/solanaLifiTypes";
import { SolanaContextTypes } from "@/solanaToken/domain/SolanaTokenContext";

import {
  type SolanaLifiContext,
  SolanaLifiContextResult,
  SolanaTransactionDescriptorList,
} from "./SolanaLifiContext";

@injectable()
export class SolanaLifiContextLoader implements SolanaLifiContext {
  constructor(
    @inject(lifiTypes.SolanaLifiDataSource)
    private readonly dataSource: SolanaLifiDataSource,
  ) {}

  public canHandle(solanaTokenContextInput: SolanaTransactionContext): boolean {
    return !!solanaTokenContextInput.templateId;
  }

  public async load(
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
