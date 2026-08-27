/**
 * Public input/output types for `ContactsManager.registerExternalAddress`.
 *
 * Proof material (`groupHandle`, `hmacProof`, `hmacRest`) is returned as raw
 * bytes; the host owns persistence and address-book state. `derivationPath` is
 * intentionally absent — the kit owns a single internal value for external
 * addresses and does not expose it.
 */

/** The existing contact group to extend, when adding an address to it. */
export type ExistingContactGroup = {
  /** 64-byte group handle returned by the group's first Register Identity. */
  readonly groupHandle: Uint8Array;
  /** 32-byte name proof (device `hmac_name`) bound to that group. */
  readonly hmacProof: Uint8Array;
};

export type RegisterExternalAddressInput = {
  readonly contactName: string;
  readonly scope: string;
  /** Chain address bytes (20 bytes for Ethereum). */
  readonly identifier: Uint8Array;
  /** Blockchain family name, e.g. "ethereum" (v1 supports Ethereum only). */
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  /**
   * Set to add the address to an existing contact group. Omit to create a new
   * contact group.
   */
  readonly existingContactGroup?: ExistingContactGroup;
  /**
   * When `true`, the open-app step is skipped (the caller guarantees the app is
   * already open). The app-version guard still runs.
   */
  readonly skipOpenApp?: boolean;
};

export type RegisterExternalAddressMode =
  | "newContactGroup"
  | "existingContactGroup";

export type RegisterExternalAddressOutput = {
  /** Whether a new contact group was created or an existing one was extended. */
  readonly mode: RegisterExternalAddressMode;
  /** Echoed input, needed by the host to persist the returned proof material. */
  readonly contactName: string;
  readonly scope: string;
  readonly identifier: Uint8Array;
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  /** Device-issued proof material. */
  readonly groupHandle: Uint8Array;
  readonly hmacProof: Uint8Array;
  readonly hmacRest: Uint8Array;
};
