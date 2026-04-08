import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type SolanaTransactionProgramRepository } from "@root/src/domain/repositories/SolanaTransactionProgramRepository";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import {
  type BatchTestResult,
  ResultFormatter,
} from "@root/src/domain/utils/ResultFormatter";

export type TestSolanaProgramConfig = {
  readonly programId: string;
  readonly programName: string;
  readonly derivationPath: string;
  readonly skipCraft?: boolean;
  readonly scanLimit?: number;
  readonly samplesPerInstruction?: number;
};

@injectable()
export class TestSolanaProgramUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SolanaTransactionProgramRepository)
    private readonly txRepository: SolanaTransactionProgramRepository,
    @inject(TYPES.DeviceRepository)
    private readonly deviceRepository: DeviceRepository,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-solana-program");
  }

  async execute(config: TestSolanaProgramConfig): Promise<BatchTestResult> {
    this.logger.info(
      `Fetching clear-signable transactions for program "${config.programName}" (${config.programId})`,
    );

    const txs = await this.txRepository.getTransactions(
      config.programId,
      config.scanLimit,
      config.samplesPerInstruction,
    );

    if (txs.length === 0) {
      console.warn(
        `No clear-signable transactions found for program "${config.programName}"`,
      );
      return ResultFormatter.formatBatchResults([], 0, {
        title: `SOLANA PROGRAM TEST RESULTS (${config.programName})`,
        summaryTitle: `SOLANA PROGRAM SUMMARY — ${config.programName} (Total: 0)`,
        includeHash: true,
      });
    }

    this.logger.info(
      `Found ${txs.length} clear-signable transaction categories`,
    );

    const results: TestResult[] = [];

    for (const [index, tx] of txs.entries()) {
      const transaction: TransactionInput = {
        kind: SignableInputKind.Transaction,
        rawTx: tx.rawTx,
        txHash: tx.signature,
        description: `[${config.programName}:${tx.category}] ${tx.signature.slice(0, 16)}...`,
        skipCraft: config.skipCraft,
      };

      this.logger.info(`Testing transaction ${index + 1}/${txs.length}`);

      try {
        const result = await this.deviceRepository.performSign(
          transaction,
          config.derivationPath,
        );

        results.push({ ...result, hash: tx.signature });
      } catch (error) {
        this.logger.error(`Transaction ${index + 1} failed`, {
          data: { error },
        });

        results.push({
          input: transaction,
          status: "error",
          timestamp: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
          hash: tx.signature,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return ResultFormatter.formatBatchResults(results, txs.length, {
      title: `SOLANA PROGRAM TEST RESULTS (${config.programName})`,
      summaryTitle: `SOLANA PROGRAM SUMMARY — ${config.programName} (Total: ${txs.length})`,
      includeHash: true,
    });
  }
}
