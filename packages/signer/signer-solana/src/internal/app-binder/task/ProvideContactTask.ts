import {
  sendProvideContactPayload,
  type SendProvideContactPayloadArgs,
} from "@ledgerhq/device-contacts-kit";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type TokenAccountOwners } from "@api/app-binder/TokenAccountOwners";
import { type SolanaAddressBook } from "@api/model/SolanaAddressBook";
import {
  buildExternalContactPayload,
  buildOwnerContactPayload,
} from "@internal/app-binder/services/contacts/buildExternalContactPayload";
import {
  extractTransferRecipient,
  type TransferRecipient,
} from "@internal/app-binder/services/contacts/extractTransferRecipient";

/**
 * How the transfer recipient is tied to a contact: directly (the contact's
 * wallet, or its associated token account), or through the owner the
 * clear-sign descriptors attested to the device for the recipient token
 * account.
 */
export type ContactMatch =
  | { readonly by: "recipient" }
  | {
      readonly by: "tokenAccountOwner";
      readonly tokenAccountOwners: TokenAccountOwners;
    };

export type ProvideContactTaskArgs = {
  readonly addressBook: SolanaAddressBook;
  readonly messageBytes: Uint8Array;
  readonly match: ContactMatch;
  readonly logger?: LoggerPublisherService;
};

/**
 * Give the device the contact registered for the transaction's recipient, so
 * the review shows its name instead of the raw address.
 *
 * The caller checks that the app supports contacts. Best effort: no match or
 * a contact the device rejects resolve without error and the signature goes
 * ahead against the raw address.
 *
 * @returns whether a contact was sent to the device, accepted or not.
 */
export class ProvideContactTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideContactTaskArgs,
  ) {}

  async run(): Promise<boolean> {
    const { addressBook, messageBytes, logger } = this.args;
    if (addressBook.contactGroups.length === 0) return false;

    const recipient = await extractTransferRecipient(messageBytes);
    if (recipient === undefined) return false;

    const payload = this.buildPayload(recipient);
    if (payload === undefined) return false;

    const result = await sendProvideContactPayload(this.api, {
      payload,
      logger,
    } satisfies SendProvideContactPayloadArgs);
    if (!isSuccessCommandResult(result)) {
      logger?.warn("[run] Contact rejected, signing without it", {
        data: { error: result.error },
      });
    }
    return true;
  }

  private buildPayload(recipient: TransferRecipient): Uint8Array | undefined {
    const { addressBook, match } = this.args;
    switch (match.by) {
      case "recipient":
        return buildExternalContactPayload({ addressBook, recipient });
      case "tokenAccountOwner":
        return buildOwnerContactPayload({
          addressBook,
          recipient,
          tokenAccountOwners: match.tokenAccountOwners,
        });
    }
  }
}
