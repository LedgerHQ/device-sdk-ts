import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ContactInput } from "@root/src/domain/models/ContactInput";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import {
  type BatchTestResult,
  ResultFormatter,
} from "@root/src/domain/utils/ResultFormatter";
import { type ContactFileRepository } from "@root/src/infrastructure/repositories/ContactFileRepository";

import { TestContactUseCase } from "./TestContactUseCase";

/** Pause between cases, matching the transaction batch loop. */
const INTER_CASE_DELAY_MS = 2000;

/**
 * Register every contact in a file.
 *
 * The device keeps registered contacts in RAM for the app session, so a case
 * that asserts the *absence* of a name cannot rely on a clean device — it says
 * so with `unexpectedTexts`.
 */
@injectable()
export class TestBatchContactFromFileUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.ContactFileRepository)
    private readonly fileRepository: ContactFileRepository,
    @inject(TYPES.TestContactUseCase)
    private readonly testContact: TestContactUseCase,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-batch-contact");
  }

  async execute(filePath: string): Promise<BatchTestResult> {
    this.logger.info(`Processing contacts from: ${filePath}`);

    const contacts = this.fileRepository.readFromFile(filePath);
    this.logger.info(`Found ${contacts.length} contact(s) to test`);

    const results: TestResult[] = [];

    for (const [index, contact] of contacts.entries()) {
      this.logger.info(
        `Testing contact ${index + 1}/${contacts.length}: ${contact.description}`,
      );

      results.push(await this.runContact(contact, index));

      await new Promise((resolve) => setTimeout(resolve, INTER_CASE_DELAY_MS));
    }

    return ResultFormatter.formatBatchResults(results, contacts.length, {
      title: "📋 CONTACT RESULTS",
      summaryTitle: "📊 CONTACT SUMMARY",
    });
  }

  private async runContact(
    contact: ContactInput,
    index: number,
  ): Promise<TestResult> {
    try {
      return await this.testContact.execute(contact);
    } catch (error) {
      this.logger.error(`Contact ${index + 1} failed`, { data: { error } });

      return {
        input: contact,
        status: "error",
        timestamp: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
