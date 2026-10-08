import {
  sendProvideContactPayload,
  type SendProvideContactPayloadArgs,
} from "@ledgerhq/device-contacts-kit";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type SolanaAddressBook } from "@api/model/SolanaAddressBook";
import { buildExternalContactPayload } from "@internal/app-binder/services/contacts/buildExternalContactPayload";
import { extractTransferRecipient } from "@internal/app-binder/services/contacts/extractTransferRecipient";

export type ProvideContactTaskArgs = {
  readonly addressBook: SolanaAddressBook;
  readonly messageBytes: Uint8Array;
  readonly logger?: LoggerPublisherService;
};

/**
 * Give the device the contact registered for the transaction's recipient, so
 * the review shows its name instead of the raw address.
 *
 * The caller checks that the app supports contacts. Best effort: no match or
 * a contact the device rejects resolve without error and the signature goes
 * ahead against the raw address.
 */
export class ProvideContactTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideContactTaskArgs,
  ) {}

  async run(): Promise<void> {
    const { addressBook, messageBytes, logger } = this.args;
    if (addressBook.contactGroups.length === 0) return;

    const recipient = await extractTransferRecipient(messageBytes);
    if (recipient === undefined) return;

    const payload = buildExternalContactPayload({ addressBook, recipient });
    if (payload === undefined) return;

    const result = await sendProvideContactPayload(this.api, {
      payload,
      logger,
    } satisfies SendProvideContactPayloadArgs);
    if (!isSuccessCommandResult(result)) {
      logger?.warn("[run] Contact rejected, signing without it", {
        data: { error: result.error },
      });
    }
  }
}
