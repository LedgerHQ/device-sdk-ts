import {
  DeviceActionStatus,
  getLogger,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type SignerEth } from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SafeAddressInput } from "@root/src/domain/models/SafeAddressInput";
import { type SafeAddressRepository } from "@root/src/domain/repositories/SafeAddressRepository";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

const REVIEW_MAX_ATTEMPTS = 20;
const REVIEW_DELAY_MS = 1500;
const WAIT_FOR_HOME_MAX_ATTEMPTS = 10;
const WAIT_FOR_HOME_DELAY_MS = 1500;

/** Not exported by signer-eth, unlike the other device actions' steps. */
const VERIFY_SAFE_ADDRESS_STEP = "signer.eth.steps.verifySafeAddress";

const CONFIRM_MARKER = "confirm";
const VALIDATED_MARKER = "safe address validated";

/**
 * Safe address repository backed by a Speculos emulator.
 *
 * Verification is a single address review, so it drives the screens directly
 * the way contact registration does, rather than through the signing flow.
 */
@injectable()
export class SpeculosSafeAddressRepository implements SafeAddressRepository {
  private readonly logger: LoggerPublisherService;

  private signer: SignerEth | null = null;

  constructor(
    @inject(TYPES.DeviceController)
    private readonly deviceController: DeviceController,
    @inject(TYPES.ScreenAnalyzerService)
    private readonly screenAnalyzer: ScreenAnalyzerService,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
  ) {
    this.logger = getLogger("safe-address-repository");
  }

  setSigner(signer: SignerEth): void {
    this.signer = signer;
  }

  /** {@inheritDoc SafeAddressRepository.verifySafeAddress} */
  async verifySafeAddress(input: SafeAddressInput): Promise<void> {
    if (!this.signer) {
      throw new Error("Safe address repository not connected to a signer");
    }

    this.logger.info(
      `Verifying Safe ${input.safeContractAddress} on chain ${input.chainId}`,
    );

    const { observable, cancel } = this.signer.verifySafeAddress(
      input.safeContractAddress,
      { chainId: input.chainId, skipOpenApp: true },
    );

    await new Promise<void>((resolve, reject) => {
      let driver: Promise<void> | undefined;
      let settled = false;

      // The step is reported before the descriptors are sent, so the action can
      // still fail while the driver polls: stop it before the next case starts.
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        void (driver ?? Promise.resolve()).then(() =>
          error ? reject(error) : resolve(),
        );
      };

      const subscription = observable.subscribe({
        next: (state) => {
          this.logger.debug("Verify Safe address state", {
            data: { state: JSON.stringify(state) },
          });

          switch (state.status) {
            case DeviceActionStatus.Pending:
              // The device action reports no required interaction while the
              // review is on screen, so the step is what says it is showing.
              if (
                !driver &&
                state.intermediateValue.step === VERIFY_SAFE_ADDRESS_STEP
              ) {
                driver = this.confirmReviewOnScreen(() => settled).catch(
                  (error: unknown) => {
                    cancel();
                    subscription.unsubscribe();
                    settle(
                      error instanceof Error ? error : new Error(String(error)),
                    );
                  },
                );
              }
              break;
            case DeviceActionStatus.Completed:
              settle();
              break;
            case DeviceActionStatus.Error:
              settle(
                new Error(
                  `Safe address rejected by the device: ${JSON.stringify(state.error)}`,
                ),
              );
              break;
            default:
              break;
          }
        },
        error: (error: unknown) =>
          settle(error instanceof Error ? error : new Error(String(error))),
      });
    });

    await this.screenshotSaver.save();
    await this.waitUntilHomePage();
  }

  private async confirmReviewOnScreen(isStopped: () => boolean): Promise<void> {
    // The step is reported before the review is drawn, and the home page is
    // also what the review returns to once confirmed.
    await this.retryService.pollUntil(
      async () => isStopped() || !(await this.screenAnalyzer.isHomePage()),
      WAIT_FOR_HOME_MAX_ATTEMPTS,
      WAIT_FOR_HOME_DELAY_MS,
    );

    await this.retryService.retryUntil(
      async () => {
        if (isStopped()) return;
        await this.screenshotSaver.save();

        if (await this.screenAnalyzer.screenContains(CONFIRM_MARKER)) {
          this.logger.debug("Detected Safe address confirmation, confirming");
          await this.deviceController.confirmSafeAddress();
          return;
        }
        await this.deviceController.navigateNext();
      },
      async () =>
        isStopped() ||
        (await this.screenAnalyzer.screenContains(VALIDATED_MARKER)) ||
        (await this.screenAnalyzer.isHomePage()),
      REVIEW_MAX_ATTEMPTS,
      REVIEW_DELAY_MS,
    );
  }

  private async waitUntilHomePage(): Promise<void> {
    try {
      await this.retryService.pollUntil(
        () => this.screenAnalyzer.isHomePage(),
        WAIT_FOR_HOME_MAX_ATTEMPTS,
        WAIT_FOR_HOME_DELAY_MS,
      );
    } catch (_error) {
      throw new Error("Home page not detected after Safe address verification");
    }
  }
}
