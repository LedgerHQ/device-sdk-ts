/**
 * Public input/output types for `ContactsManager.editExternalAddressIdentifier`.
 *
 * EDIT IDENTIFIER replaces an entry's identifier bytes within an existing
 * contact group. Only the address-level `hmacRest` rotates; the group-level
 * `hmacProof` passes through unchanged. Proof material is raw bytes (the host
 * owns persistence); `derivationPath` is kit-internal and not exposed.
 */

export type EditExternalAddressIdentifierInput = {
  /** The contact's name, proven to the device via `hmacProof`. */
  readonly contactName: string;
  /** The entry's current label/scope; shown on the approval screen. */
  readonly scope: string;
  /** The current (pre-edit) address bytes, proven via `hmacRest`. */
  readonly previousIdentifier: Uint8Array;
  /** The replacement address bytes (20 bytes for Ethereum). */
  readonly newIdentifier: Uint8Array;
  /** Blockchain family name, e.g. "ethereum" (v1 supports Ethereum only). */
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  /** 64-byte group handle returned by the group's Register Identity. */
  readonly groupHandle: Uint8Array;
  /**
   * The contact-group name proof (device `hmac_name`) — passed back so the
   * device can verify the entry belongs to the group. Unchanged by the edit.
   */
  readonly hmacProof: Uint8Array;
  /**
   * The entry's current 32-byte address proof (`hmac_rest`) — passed back so the
   * device can verify continuity before approving. Replaced by the returned
   * `hmacRest` on success.
   */
  readonly hmacRest: Uint8Array;
  /**
   * When `true`, the open-app step is skipped (the caller guarantees the app is
   * already open). The app-version guard still runs.
   */
  readonly skipOpenApp?: boolean;
};

export type EditExternalAddressIdentifierOutput = {
  /** Echoed input, needed by the host to locate the entry it is replacing. */
  readonly contactName: string;
  readonly scope: string;
  /** Echoed previous address bytes, to match the entry being replaced. */
  readonly previousIdentifier: Uint8Array;
  /** The new address bytes now bound to the entry. */
  readonly identifier: Uint8Array;
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  /** Echoed group handle, unchanged by the edit. */
  readonly groupHandle: Uint8Array;
  /** Echoed group-level name proof, unchanged by the edit. */
  readonly hmacProof: Uint8Array;
  /** The replacement address-level proof (rotated `hmac_rest`) to persist. */
  readonly hmacRest: Uint8Array;
};
