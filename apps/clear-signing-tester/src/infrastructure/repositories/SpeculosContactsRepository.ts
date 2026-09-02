import {
  type ContactsManager,
  type RegisterExternalAddressDAReturnType,
} from "@ledgerhq/device-contacts-kit";
import {
  DeviceActionStatus,
  hexaStringToBuffer,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type DeviceController } from "@root/src/domain/adapters/DeviceController";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type ContactInput } from "@root/src/domain/models/ContactInput";
import {
  type ContactProofs,
  type ContactsRepository,
} from "@root/src/domain/repositories/ContactsRepository";
import { type RetryService } from "@root/src/domain/services/RetryService";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";

/** The only blockchain family Contacts supports in v1. */
const BLOCKCHAIN_FAMILY = "ethereum";

/** The review is a handful of pages; 20 taps is a generous ceiling. */
const REVIEW_MAX_ATTEMPTS = 20;
const REVIEW_DELAY_MS = 1500;
const WAIT_FOR_HOME_MAX_ATTEMPTS = 10;
const WAIT_FOR_HOME_DELAY_MS = 1500;

/** Screen markers of the three Address Book review pages. */
const REVIEW_MARKER = "review contact details";
const CONFIRM_MARKER = "confirm contact details";
const SAVED_MARKER = "saved to your contacts";

/**
 * Contacts repository backed by a Speculos emulator.
 *
 * Registration is a single-interaction flow — swipe through the review, tap
 * confirm — so it drives the screens directly rather than going through the
 * state-handler machinery the signing flow needs.
 *
 * The manager arrives from the service controller once the device session
 * exists, the same way the signing service receives its signer.
 */
@injectable()
export class SpeculosContactsRepository implements ContactsRepository {
  private readonly logger: LoggerPublisherService;

  private contactsManager: ContactsManager | null = null;

  constructor(
    @inject(TYPES.DeviceController)
    private readonly deviceController: DeviceController,
    @inject(TYPES.ScreenAnalyzerService)
    private readonly screenAnalyzer: ScreenAnalyzerService,
    @inject(TYPES.RetryService)
    private readonly retryService: RetryService,
    @inject(TYPES.ScreenshotSaver)
    private readonly screenshotSaver: ScreenshotSaver,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("contacts-repository");
  }

  /** Hand over the manager that drives REGISTER IDENTITY for this session. */
  setContactsManager(contactsManager: ContactsManager): void {
    this.contactsManager = contactsManager;
  }

  /** {@inheritDoc ContactsRepository.registerContact} */
  async registerContact(contact: ContactInput): Promise<ContactProofs> {
    this.logger.info(
      `Registering contact "${contact.contactName}" for ${contact.address} on chain ${contact.chainId}`,
    );

    await this.screenshotSaver.save();

    const { observable } = this.register(contact);

    const proofs = await new Promise<ContactProofs>((resolve, reject) => {
      let driving = false;

      observable.subscribe({
        next: (state) => {
          this.logger.debug("Register contact state", {
            data: { state: serialize(state) },
          });

          switch (state.status) {
            case DeviceActionStatus.Pending:
              // The device action emits Pending repeatedly; drive the screens
              // once and let the loop run to completion.
              if (!driving) {
                driving = true;
                void this.confirmReviewOnScreen().catch(reject);
              }
              break;
            case DeviceActionStatus.Completed:
              resolve({
                groupHandle: state.output.groupHandle,
                hmacProof: state.output.hmacProof,
                hmacRest: state.output.hmacRest,
              });
              break;
            case DeviceActionStatus.Error:
              reject(
                new Error(
                  `Contact registration rejected by the device: ${serialize(state.error)}`,
                ),
              );
              break;
            default:
              break;
          }
        },
        error: reject,
      });
    });

    await this.screenshotSaver.save();
    await this.waitUntilHomePage();

    this.logger.info(`Contact "${contact.contactName}" registered on device`);

    return proofs;
  }

  /** Start REGISTER IDENTITY for `contact` on the connected device. */
  private register(contact: ContactInput): RegisterExternalAddressDAReturnType {
    if (!this.contactsManager) {
      throw new Error("Contacts repository not connected to a device session");
    }

    const identifier = hexaStringToBuffer(contact.address);
    if (!identifier) {
      throw new Error(`Invalid contact address: ${contact.address}`);
    }

    return this.contactsManager.registerExternalAddress({
      contactName: contact.contactName,
      scope: contact.scope,
      identifier,
      blockchainFamily: BLOCKCHAIN_FAMILY,
      chainId: contact.chainId,
      // The tester connects with the app already open; the version guard on the
      // running app still runs.
      skipOpenApp: true,
    });
  }

  /**
   * Swipe through the contact review and tap its confirm button.
   *
   * Stops as soon as the device reports the contact stored, which also covers
   * the case where the device dismisses the status screen on its own.
   */
  private async confirmReviewOnScreen(): Promise<void> {
    await this.retryService.retryUntil(
      async () => {
        await this.screenshotSaver.save();

        if (await this.screenAnalyzer.screenContains(CONFIRM_MARKER)) {
          this.logger.debug(
            "Detected contact confirmation page, tapping 'Confirm'",
          );
          await this.deviceController.confirmContactRegistration();
          return;
        }

        if (await this.screenAnalyzer.screenContains(REVIEW_MARKER)) {
          this.logger.debug("Detected contact review page, swiping");
        }
        await this.deviceController.navigateNext();
      },
      async () =>
        (await this.screenAnalyzer.screenContains(SAVED_MARKER)) ||
        (await this.screenAnalyzer.isHomePage()),
      REVIEW_MAX_ATTEMPTS,
      REVIEW_DELAY_MS,
    );
  }

  /**
   * Wait for the app home page before handing back to the signing flow, which
   * starts by waiting for the screen to *leave* home and would otherwise read
   * the lingering "Saved to your Contacts" status as a transaction page.
   */
  private async waitUntilHomePage(): Promise<void> {
    try {
      await this.retryService.pollUntil(
        () => this.screenAnalyzer.isHomePage(),
        WAIT_FOR_HOME_MAX_ATTEMPTS,
        WAIT_FOR_HOME_DELAY_MS,
      );
    } catch (_error) {
      throw new Error(
        "Home page not detected after contact registration completed",
      );
    }
  }
}

/**
 * Register states carry `chainId` as a bigint, which `JSON.stringify` throws
 * on. Everything logged here goes through this instead.
 */
function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? `${item}` : item,
  );
}
