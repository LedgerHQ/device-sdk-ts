import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";

import {
  type BatchTestConfig,
  TestBatchFromFileUseCase,
} from "./TestBatchFromFileUseCase";

// Re-export for convenience
export type { BatchTestConfig };

/**
 * Use case for testing a batch of transactions from a file
 * Specialization of TestBatchFromFileUseCase for TransactionInput
 */
@injectable()
export class TestBatchTransactionFromFileUseCase extends TestBatchFromFileUseCase<TransactionInput> {
  constructor(
    @inject(TYPES.TransactionFileRepository)
    transactionFileRepository: DataFileRepository<TransactionInput>,
    @inject(TYPES.DeviceRepository)
    deviceRepository: DeviceRepository,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    super(
      transactionFileRepository,
      deviceRepository,
      (deviceRepo, input, derivationPath) =>
        deviceRepo.performSignTransaction(input, derivationPath),
      {
        title: "📋 TRANSACTION TEST RESULTS",
        summaryTitle: "📊 TRANSACTION BATCH SUMMARY",
        itemName: "transaction",
      },
      loggerFactory,
      "test-batch-transaction",
    );
  }
}
