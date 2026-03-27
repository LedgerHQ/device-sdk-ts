import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type SolanaRpcAdapter } from "@root/src/domain/adapters/SolanaRpcAdapter";
import { type SolanaTransactionData } from "@root/src/domain/models/SolanaTransactionData";
import { type SolanaTransactionProgramRepository } from "@root/src/domain/repositories/SolanaTransactionProgramRepository";

@injectable()
export class DefaultSolanaTransactionProgramRepository
  implements SolanaTransactionProgramRepository
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SolanaRpcAdapter)
    private readonly rpcAdapter: SolanaRpcAdapter,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("solana-program-tx-repository");
  }

  async getTransactions(
    programId: string,
    scanLimit?: number,
    samplesPerInstruction?: number,
  ): Promise<SolanaTransactionData[]> {
    this.logger.debug("Getting clear-signable transactions for program", {
      data: { programId, scanLimit, samplesPerInstruction },
    });

    const transactions = await this.rpcAdapter.fetchClearSignableTransactions(
      programId,
      scanLimit,
      samplesPerInstruction,
    );

    this.logger.debug("Got transactions", {
      data: { count: transactions.length },
    });

    return transactions;
  }
}
