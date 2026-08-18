/**
 * Public input/output types for `ContactsManager.registerLedgerAccount`.
 *
 * A Ledger account is a signer-controlled account derived on the device from
 * `derivationPath`; unlike an external address there is no explicit identifier
 * or contact-group branch. The device returns a single 32-byte `hmacProof`
 * (returned as raw bytes); the host owns persistence and address-book state.
 */

export type RegisterLedgerAccountInput = {
  readonly accountName: string;
  /** BIP32 path of the account to register, e.g. "m/44'/60'/0'/0/0". */
  readonly derivationPath: string;
  /** Blockchain family name, e.g. "ethereum" (v1 supports Ethereum only). */
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  /**
   * When `true`, the open-app step is skipped (the caller guarantees the app is
   * already open). The app-version guard still runs.
   */
  readonly skipOpenApp?: boolean;
};

export type RegisterLedgerAccountOutput = {
  /** Echoed input, needed by the host to persist the returned proof material. */
  readonly accountName: string;
  readonly derivationPath: string;
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  /** Device-issued 32-byte HMAC proof binding this Ledger account. */
  readonly hmacProof: Uint8Array;
};
