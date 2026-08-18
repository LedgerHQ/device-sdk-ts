import { type RegisterLedgerAccountInput } from "@api/model/RegisterLedgerAccount";
import { BLOCKCHAIN_FAMILY_BY_NAME } from "@internal/app-binder/model/contactsConstants";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
} from "@internal/app-binder/model/contactsValidation";

/**
 * Validate the caller input for Register Ledger Account. Returns the first
 * `ContactsValidationError` found, or `null` when the input is valid.
 *
 * Non-throwing by design: the device action calls this so an invalid input is
 * surfaced as a typed terminal error state on the observable, keeping the
 * public `ContactsManager.registerLedgerAccount` free of synchronous throws.
 */
export function validateRegisterLedgerAccountInput(
  input: RegisterLedgerAccountInput,
): ContactsValidationError | null {
  try {
    validatePrintableLabel(input.accountName, {
      field: "accountName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validateDerivationPath(input.derivationPath);

    const family = input.blockchainFamily.toLowerCase();
    if (!(family in BLOCKCHAIN_FAMILY_BY_NAME)) {
      throw new ContactsValidationError(
        `Unsupported blockchain family: ${input.blockchainFamily}`,
      );
    }
    if (family === "ethereum" && input.chainId === undefined) {
      // CHAIN_ID is mandatory for the Ethereum family (multiple networks share
      // the same account derivation).
      throw new ContactsValidationError(
        "chainId is required for the Ethereum blockchain family.",
      );
    }

    if (input.chainId !== undefined) {
      validateChainId(input.chainId);
    }

    return null;
  } catch (error) {
    if (error instanceof ContactsValidationError) {
      return error;
    }
    throw error;
  }
}
