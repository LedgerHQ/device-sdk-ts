/**
 * Public input/output types for `ContactsManager.renameContact`.
 *
 * Rename (EDIT CONTACT NAME) is a blockchain-agnostic OS/dashboard operation:
 * it rotates the contact-level `hmacProof` (the device's `hmac_name`) and
 * returns the fresh proof. The per-entry `hmacRest` values are untouched — they
 * bind scope/identifier/family/chainId, never the name — so only the group's
 * name proof needs re-persisting.
 *
 * Proof material (`groupHandle`, `hmacProof`) is passed and returned as raw
 * bytes; the host owns persistence and address-book state. `derivationPath` is
 * kit-internal and not exposed: the Ethereum app requires a path on the wire
 * (a default m/44'/60'/0'/0/0 is sent), but the rename itself is name-only.
 */

export type RenameContactInput = {
  /** The contact's current name, proven to the device via `hmacProof`. */
  readonly previousContactName: string;
  /** The new name to assign to the contact group. */
  readonly newContactName: string;
  /** 64-byte group handle returned by the group's Register Identity. */
  readonly groupHandle: Uint8Array;
  /**
   * The existing 32-byte name proof (device `hmac_name`) bound to the current
   * name — passed back so the device can verify continuity before approving the
   * rename. Replaced by the returned `hmacProof` on success.
   */
  readonly hmacProof: Uint8Array;
};

export type RenameContactOutput = {
  /** Echoed previous name, for the host to locate the entry it is replacing. */
  readonly previousContactName: string;
  /** The new name now bound to the contact group. */
  readonly contactName: string;
  /** Echoed group handle, unchanged by the rename. */
  readonly groupHandle: Uint8Array;
  /** The replacement group-level name proof (rotated `hmac_name`) to persist. */
  readonly hmacProof: Uint8Array;
};
