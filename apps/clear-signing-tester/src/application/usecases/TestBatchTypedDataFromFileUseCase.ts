import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";

import {
  type BatchTestConfig,
  TestBatchFromFileUseCase,
} from "./TestBatchFromFileUseCase";

// Re-export for convenience
export type { BatchTestConfig };

/**
 * Use case for testing a batch of typed data from a file
 * Specialization of TestBatchFromFileUseCase for TypedDataInput
 */
@injectable()
export class TestBatchTypedDataFromFileUseCase extends TestBatchFromFileUseCase<TypedDataInput> {
  constructor(
    @inject(TYPES.TypedDataFileRepository)
    typedDataFileRepository: DataFileRepository<TypedDataInput>,
    @inject(TYPES.DeviceRepository)
    deviceRepository: DeviceRepository,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    super(
      typedDataFileRepository,
      deviceRepository,
      (deviceRepo, input, derivationPath) =>
        deviceRepo.performSignTypedData(input, derivationPath),
      {
        title: "📋 TYPED DATA TEST RESULTS",
        summaryTitle: "📊 TYPED DATA BATCH SUMMARY",
        itemName: "typed data",
      },
      loggerFactory,
      "test-batch-typed-data",
    );
  }
}
