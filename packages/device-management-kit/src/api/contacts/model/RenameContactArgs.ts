/**
 * Arguments for `ContactsService.renameContact`.
 *
 * Single APDU regardless of the contact's entry count — the device rotates
 * the contact-level `hmac_name` and returns the fresh proof; per-entry
 * `hmac_rest` values are untouched (they cover `gid|scope|id|family|chain_id`,
 * never the name).
 *
 * `hmacProofHex` is the existing `hmac_name` from the wallet shape — passed
 * back so the device can verify continuity before approving the rename.
 *
 * `derivationPath` is the contact's shared path (all entries on a contact
 * necessarily share one path because the device's K_identity verify uses it
 * on Register-extend and Edit-Contact-Name alike). Send `entries[0].derivationPath`.
 */
export type RenameContactArgs = {
  readonly oldName: string;
  readonly newName: string;
  readonly groupHandleHex: string;
  readonly hmacProofHex: string;
  readonly derivationPath: string;
};

export type RenameContactResult = {
  readonly hmacNameHex: string;
};
