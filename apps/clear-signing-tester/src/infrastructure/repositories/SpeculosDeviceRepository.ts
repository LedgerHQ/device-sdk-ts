import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { type TestResult } from "@root/src/domain/types/TestStatus";

@injectable()
export class SpeculosDeviceRepository implements DeviceRepository {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SigningFlowOrchestrator)
    private readonly orchestrator: FlowOrchestrator,
    @inject(TYPES.SigningService)
    private readonly signingService: SigningService,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
  ) {
    this.logger = loggerFactory("device-repository");
  }

  async performSignTransaction(
    transaction: TransactionInput,
    derivationPath: string,
  ): Promise<TestResult> {
    this.logger.debug("Performing sign transaction", {
      data: { derivationPath, transaction },
    });

    await this.screenshotSaver.save();

    const signTransactionDA = this.signingService.signTransaction(
      derivationPath,
      transaction.rawTx,
    );

    return await this.orchestrator.orchestrateSigningFlow(
      signTransactionDA,
      transaction,
    );
  }

  async performSignTypedData(
    typedData: TypedDataInput,
    derivationPath: string,
  ): Promise<TestResult> {
    this.logger.debug("Performing sign typed data", {
      data: { derivationPath, typedData },
    });

    await this.screenshotSaver.save();

    const signTypedDataDA = this.signingService.signTypedData(
      derivationPath,
      typedData.data,
    );

    return await this.orchestrator.orchestrateSigningFlow(
      signTypedDataDA,
      typedData,
    );
  }
}
