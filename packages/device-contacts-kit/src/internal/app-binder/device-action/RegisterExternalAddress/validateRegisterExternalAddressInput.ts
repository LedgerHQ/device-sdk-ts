import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { BLOCKCHAIN_FAMILY_BY_NAME } from "@internal/app-binder/model/contactsConstants";
import {
  CONTACT_NAME_BUFFER_LENGTH,
  ContactsValidationError,
  ETH_ADDRESS_BYTES,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  SCOPE_BUFFER_LENGTH,
  validateByteLength,
  validateChainId,
  validatePrintableLabel,
} from "@internal/app-binder/model/contactsValidation";

/**
 * Validate the caller input for Register External Address. Returns the first
 * `ContactsValidationError` found, or `null` when the input is valid.
 *
 * Non-throwing by design: the device action calls this so an invalid input is
 * surfaced as a typed terminal error state on the observable, keeping the
 * public `ContactsManager.registerExternalAddress` free of synchronous throws.
 */
export function validateRegisterExternalAddressInput(
  input: RegisterExternalAddressInput,
): ContactsValidationError | null {
  try {
    validatePrintableLabel(input.contactName, {
      field: "contactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(input.scope, {
      field: "scope",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });

    const family = input.blockchainFamily.toLowerCase();
    if (!(family in BLOCKCHAIN_FAMILY_BY_NAME)) {
      throw new ContactsValidationError(
        `Unsupported blockchain family: ${input.blockchainFamily}`,
      );
    }
    if (family === "ethereum") {
      validateByteLength(input.identifier, {
        field: "identifier",
        expectedBytes: ETH_ADDRESS_BYTES,
      });
      // CHAIN_ID is mandatory for the Ethereum family (multiple networks share
      // the same address format).
      if (input.chainId === undefined) {
        throw new ContactsValidationError(
          "chainId is required for the Ethereum blockchain family.",
        );
      }
    } else if (input.identifier.length === 0) {
      throw new ContactsValidationError("identifier must not be empty.");
    }

    if (input.chainId !== undefined) {
      validateChainId(input.chainId);
    }

    if (input.existingContactGroup) {
      validateByteLength(input.existingContactGroup.groupHandle, {
        field: "existingContactGroup.groupHandle",
        expectedBytes: GROUP_HANDLE_SIZE,
      });
      validateByteLength(input.existingContactGroup.hmacProof, {
        field: "existingContactGroup.hmacProof",
        expectedBytes: HMAC_PROOF_LENGTH,
      });
    }

    return null;
  } catch (error) {
    if (error instanceof ContactsValidationError) {
      return error;
    }
    throw error;
  }
}
