import { type ContactInput } from "@root/src/domain/models/ContactInput";

/** The device-issued proof material returned by REGISTER IDENTITY. */
export type ContactProofs = {
  readonly groupHandle: Uint8Array;
  readonly hmacProof: Uint8Array;
  readonly hmacRest: Uint8Array;
};

/**
 * Adding a contact to the device. Binding an address book to the signer is not
 * here: that is a signer build-time option, driven by `--address-book`.
 *
 * Separate from {@link DeviceRepository}, which stays chain-agnostic: Contacts
 * is Ethereum-only in v1 and is bound only by the Ethereum module.
 */
export interface ContactsRepository {
  /**
   * Register `contact` on the device, confirming the review on screen, and
   * return the proofs an address book needs to carry it.
   *
   * @param contact - The contact to register.
   * @throws Error when the device rejects the registration.
   */
  registerContact(contact: ContactInput): Promise<ContactProofs>;
}
