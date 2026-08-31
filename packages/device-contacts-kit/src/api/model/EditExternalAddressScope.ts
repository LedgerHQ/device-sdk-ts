/**
 * Public input/output types for `ContactsManager.editExternalAddressScope`.
 *
 * EDIT SCOPE replaces an entry's scope (its context label) within an existing
 * contact group while keeping the same contact name and identifier. Only the
 * address-level `hmacRest` rotates; the group-level `hmacProof` passes through
 * unchanged. Proof material is raw bytes (the host owns persistence);
 * `derivationPath` is kit-internal and not exposed.
 */

export type EditExternalAddressScopeInput = {
  /** The contact's name, proven to the device via `hmacProof`. Unchanged. */
  readonly contactName: string;
  /** The entry's current scope; shown on the approval screen and proven via `hmacRest`. */
  readonly previousScope: string;
  /** The replacement scope (max 32 printable ASCII chars). */
  readonly newScope: string;
  /** The entry's identifier bytes (20 bytes for Ethereum). Unchanged by the edit. */
  readonly identifier: Uint8Array;
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
   * device can verify the previous scope/identifier before approving. Replaced
   * by the returned `hmacRest` on success.
   */
  readonly hmacRest: Uint8Array;
  /**
   * When `true`, the open-app step is skipped (the caller guarantees the app is
   * already open). The app-version guard still runs.
   */
  readonly skipOpenApp?: boolean;
};

export type EditExternalAddressScopeOutput = {
  /** Echoed input, needed by the host to locate the entry it is replacing. */
  readonly contactName: string;
  /** Echoed previous scope, to match the entry being replaced. */
  readonly previousScope: string;
  /** The new scope now bound to the entry. */
  readonly scope: string;
  /** Echoed identifier bytes, unchanged by the edit. */
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
