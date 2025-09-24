import { inject, injectable } from "inversify";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "@/solanaLifi/data/SolanaLifiDataSource";
import { lifiTypes } from "@/solanaLifi/di/solanaLifiTypes";

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
        type: ClearSignContextType.ERROR,
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
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): SolanaLifiContextResult => ({
        type: ClearSignContextType.SOLANA_LIFI,
        payload: this.pluckTransactionnData(value),
      }),
    });
  }

  private pluckTransactionnData(
    tokenData: GetTransactionDescriptorsResponse,
  ): SolanaTransactionDescriptorList {
    return {
      ...tokenData.descriptors,
    };
  }
}
