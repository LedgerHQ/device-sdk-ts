import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";

/**
 * Public, stateless Contacts (Address Book) manager.
 *
 * It only drives device interactions — taking caller input, running the device
 * operation, and returning the device output (including proof material). It
 * does not store anything, own the address book, or handle persistence; the
 * host is responsible for that.
 */
export interface ContactsManager {
  /**
   * Register an external address on the device — either creating a new contact
   * group or adding the address to an existing one (via
   * `input.existingContactGroup`). Opens the embedded app by default (pass
   * `skipOpenApp: true` to skip only the open-app step; the version guard still
   * runs), checks the Contacts version requirements, then runs REGISTER
   * IDENTITY. Returns the device-issued group handle and proofs to persist.
   */
  registerExternalAddress(
    input: RegisterExternalAddressInput,
  ): RegisterExternalAddressDAReturnType;
}
