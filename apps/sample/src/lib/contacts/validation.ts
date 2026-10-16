/**
 * Form validation for the Contacts playground, with Ledger Wallet's rules and
 * copy: printable ASCII names and labels of at most 32 characters, unique per
 * book (names) or per contact (labels), and addresses in their family's format.
 */
import {
  type AddressBook,
  type ExternalAddress,
  findGroupById,
  formatIdentifier,
  parseHexField,
} from "@/lib/contacts/addressBook";
import { type ContactsFamilyDescriptor } from "@/lib/contacts/families";

export const CONTACT_NAME_MAX_LENGTH = 32;
export const CONTACT_ADDRESS_LABEL_MAX_LENGTH = 32;

const CONTACT_NAME_PATTERN = /^(?=.*[^ ])[\x20-\x7E]+$/;
const CONTACT_ADDRESS_LABEL_PATTERN = /^(?=.*[A-Za-z0-9])[\x20-\x7E]+$/;

/** An error message for the field, or undefined when it is valid or empty. */
export type FieldError = string | undefined;

export function validateContactName(
  book: AddressBook,
  name: string,
  ownGroupId?: string,
): FieldError {
  const trimmed = name.trim();
  if (trimmed.length === 0) return undefined;
  if (
    trimmed.length > CONTACT_NAME_MAX_LENGTH ||
    !CONTACT_NAME_PATTERN.test(trimmed)
  ) {
    return "Special characters are not allowed.";
  }
  const taken = book.contactGroups.some(
    (g) =>
      g.id !== ownGroupId &&
      g.contactName.toLowerCase() === trimmed.toLowerCase(),
  );
  return taken ? "This contact name is already in use." : undefined;
}

export function validateAddressLabel(
  book: AddressBook,
  groupId: string,
  label: string,
  ownAddressId?: string,
): FieldError {
  const trimmed = label.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > CONTACT_ADDRESS_LABEL_MAX_LENGTH) {
    return "Address names must be 32 characters or fewer.";
  }
  if (!CONTACT_ADDRESS_LABEL_PATTERN.test(trimmed)) {
    return "Special characters are not allowed.";
  }
  const taken = book.externalAddresses.some(
    (a) =>
      a.contactGroupId === groupId &&
      a.id !== ownAddressId &&
      a.scope.toLowerCase() === trimmed.toLowerCase(),
  );
  return taken
    ? "This address name is already used for this contact."
    : undefined;
}

export type AddressCheck =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "valid"; identifier: Uint8Array };

/** The stored address in its family's display form. */
export function displayAddress(address: ExternalAddress): string {
  return formatIdentifier(
    address.blockchainFamily,
    parseHexField(address.address, "address"),
  );
}

/**
 * Check an address typed for `family`: its format, and that no contact already
 * holds it on the same network (`ownAddressId` excludes the edited entry).
 */
export function checkAddress(
  book: AddressBook,
  family: ContactsFamilyDescriptor,
  chainId: bigint | undefined,
  value: string,
  ownAddressId?: string,
): AddressCheck {
  if (value.trim().length === 0) return { status: "empty" };
  const identifier = family.parse(value);
  if (!identifier) {
    return { status: "invalid", message: "Incorrect address format." };
  }
  const formatted = family.format(identifier);
  const duplicate = book.externalAddresses.find(
    (a) =>
      a.id !== ownAddressId &&
      a.blockchainFamily === family.family &&
      a.chainId === chainId &&
      displayAddress(a) === formatted,
  );
  if (duplicate) {
    const owner = findGroupById(book, duplicate.contactGroupId);
    return {
      status: "invalid",
      message: `This address is already used for ${owner?.contactName ?? "another contact"}.`,
    };
  }
  return { status: "valid", identifier };
}
