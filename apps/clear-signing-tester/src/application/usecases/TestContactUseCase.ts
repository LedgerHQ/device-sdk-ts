import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ContactInput } from "@root/src/domain/models/ContactInput";
import { type ContactsRepository } from "@root/src/domain/repositories/ContactsRepository";
import { type ScreenAnalyzerService } from "@root/src/domain/services/ScreenAnalyzer";
import { type TestResult } from "@root/src/domain/types/TestStatus";

/**
 * Register one contact on the device and report what its review screens showed.
 *
 * This is the whole flow: no signing, so a failure here is the Ethereum app's
 * Address Book behaviour and nothing else. The proofs the device returns are
 * logged, since that is how an address book for the signing flow is produced.
 */
@injectable()
export class TestContactUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.ContactsRepository)
    private readonly contactsRepository: ContactsRepository,
    @inject(TYPES.ScreenAnalyzerService)
    private readonly screenAnalyzer: ScreenAnalyzerService,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-contact");
  }

  async execute(contact: ContactInput): Promise<TestResult> {
    this.logger.info(`Registering contact: ${contact.description}`);

    const proofs = await this.contactsRepository.registerContact(contact);

    this.logger.info("Contact registered, proofs for an address book file", {
      data: {
        groupHandle: hex(proofs.groupHandle),
        hmacProof: hex(proofs.hmacProof),
        hmacRest: hex(proofs.hmacRest),
      },
    });

    const analysis = await this.screenAnalyzer.analyzeAccumulatedTexts(
      contact.expectedTexts ?? [],
      contact.unexpectedTexts ?? [],
    );

    return {
      input: contact,
      status: analysis.containsAll ? "clear_signed" : "partially_clear_signed",
      timestamp: new Date().toISOString(),
    };
  }
}

const hex = (bytes: Uint8Array) =>
  `0x${Buffer.from(bytes).toString("hex")}` as const;
