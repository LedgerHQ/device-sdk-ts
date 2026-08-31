import { type EditExternalAddressIdentifierDAReturnType } from "@api/app-binder/EditExternalAddressIdentifierDeviceActionTypes";
import { type EditExternalAddressScopeDAReturnType } from "@api/app-binder/EditExternalAddressScopeDeviceActionTypes";
import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RenameContactDAReturnType } from "@api/app-binder/RenameContactDeviceActionTypes";
import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
import { type EditExternalAddressScopeInput } from "@api/model/EditExternalAddressScope";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { type RenameContactInput } from "@api/model/RenameContact";

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

  /**
   * Rename an existing contact group (EDIT CONTACT NAME). This is a
   * blockchain-agnostic dashboard operation served by the device OS: it always
   * navigates to the dashboard first (never opens an app), checks the Contacts
   * minimum OS version, then rotates the group's name proof. Pass the current
   * `previousContactName`, the `newContactName`, the group's `groupHandle`, and
   * the existing `hmacProof`; returns the replacement group-level `hmacProof` to
   * persist.
   */
  renameContact(input: RenameContactInput): RenameContactDAReturnType;

  /**
   * Edit an external address's identifier (EDIT IDENTIFIER) — replace an entry's
   * address bytes within a contact group. Opens the app by default (`skipOpenApp:
   * true` skips it; the version guard still runs) and checks the Contacts version
   * requirements. Pass the previous/new identifiers, `groupHandle`, `hmacProof`,
   * and current `hmacRest`; returns the replacement `hmacRest` (the `hmacProof`
   * is unchanged).
   */
  editExternalAddressIdentifier(
    input: EditExternalAddressIdentifierInput,
  ): EditExternalAddressIdentifierDAReturnType;

  /**
   * Edit an external address's scope (EDIT SCOPE) — replace an entry's scope
   * (its context label) within a contact group while keeping the same contact
   * name and identifier. Opens the app by default (`skipOpenApp: true` skips it;
   * the version guard still runs) and checks the Contacts version requirements.
   * Pass the previous/new scopes, `identifier`, `groupHandle`, `hmacProof`, and
   * current `hmacRest`; returns the replacement `hmacRest` (the `hmacProof` is
   * unchanged).
   */
  editExternalAddressScope(
    input: EditExternalAddressScopeInput,
  ): EditExternalAddressScopeDAReturnType;
}
