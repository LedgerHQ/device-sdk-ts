import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SignableInput } from "@root/src/domain/models/SignableInput";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type FlowOrchestrator } from "@root/src/domain/services/FlowOrchestrator";
import { type SigningService } from "@root/src/domain/services/SigningService";
import { type TestResult } from "@root/src/domain/types/TestStatus";

/**
 * Device repository backed by a Speculos emulator.
 *
 * Delegates signing to the injected {@link SigningService}, keeping the
 * repository itself chain-agnostic.
 */
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

  /** {@inheritDoc DeviceRepository.performSign} */
  async performSign(
    input: SignableInput,
    derivationPath: string,
  ): Promise<TestResult> {
    this.logger.debug("Performing sign", {
      data: { derivationPath, kind: input.kind },
    });

    await this.screenshotSaver.save();

    const signingResult = await this.signingService.sign(input, derivationPath);

    return await this.orchestrator.orchestrateSigningFlow(signingResult, input);
  }
}
