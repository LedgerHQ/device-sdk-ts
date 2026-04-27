export type TransactionOptions = {
  skipOpenApp?: boolean;
  /**
   * When set, the transaction fee (in µCCD) is sent to the device along with
   * the transaction so the device can display it to the user before signing.
   *
   * The fee is NOT part of the hashed transaction payload — it is only used
   * for on-device display. Ignored on Concordium app firmware < 5.5.2, which
   * falls back to the legacy signing path with no fee screen.
   */
  displayFeeMicroCcd?: bigint;
};
