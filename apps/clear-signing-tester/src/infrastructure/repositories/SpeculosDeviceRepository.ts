import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable, optional } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import {
  type SigningServiceResult,
  type TransactionSigningService,
} from "@root/src/domain/services/TransactionSigningService";
import { type TypedDataSigningService } from "@root/src/domain/services/TypedDataSigningService";
import { type TestResult } from "@root/src/domain/types/TestStatus";

/**
 * Device repository backed by a Speculos emulator.
 *
 * Dispatches signing to the correct service based on the {@link SignableInput}
 * discriminant (`kind`), keeping the repository itself chain-agnostic.
 */
@injectable()
export class SpeculosDeviceRepository implements DeviceRepository {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SigningFlowOrchestrator)
    private readonly orchestrator: FlowOrchestrator,
    @inject(TYPES.TransactionSigningService)
    private readonly transactionSigningService: TransactionSigningService,
    @inject(TYPES.TypedDataSigningService)
    @optional()
    private readonly typedDataSigningService: TypedDataSigningService | null,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
  ) {
    this.logger = loggerFactory("device-repository");
  }

  /** {@inheritDoc DeviceRepository.performSign} */
  async performSign(
    input: SignableInput,
    derivationPath: string,
  ): Promise<TestResult> {
    this.logger.debug("Performing sign", {
      data: { derivationPath, kind: input.kind },
    });

    await this.screenshotSaver.save();

    let signingResult: SigningServiceResult;

    switch (input.kind) {
      case SignableInputKind.Transaction: {
        signingResult = this.transactionSigningService.signTransaction(
          derivationPath,
          input.rawTx,
        );
        break;
      }
      case SignableInputKind.TypedData: {
        if (!this.typedDataSigningService) {
          throw new Error(
            "TypedDataSigningService is not available in this configuration",
          );
        }
        signingResult = this.typedDataSigningService.signTypedData(
          derivationPath,
          input.data,
        );
        break;
      }
      default: {
        const _exhaustive: never = input;
        throw new Error(
          `Unsupported input kind: ${(_exhaustive as SignableInput).kind}`,
        );
      }
    }

    return await this.orchestrator.orchestrateSigningFlow(signingResult, input);
  }
}
