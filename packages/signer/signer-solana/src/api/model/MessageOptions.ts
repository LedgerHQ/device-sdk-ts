export enum SignMessageVersion {
  /**
   * Pass-through mode: sends `sendingData` directly to the device with no
   * header wrapping. Use this when the caller has already built a valid
   * off-chain message payload (e.g. a correctly formatted V0 or V1 OCM).
   * Returns a plain base58 signature (no envelope).
   */
  Raw = "raw",
  /**
   * Compact V0 header without `appDomain` or signer fields.
   * Only recognised by older Solana app firmware versions.
   * Current firmware (>= 1.x) requires the full V0 header and will
   * reject this format with `6a81`.
   */
  Legacy = "legacy",
  V0 = "v0",
  V1 = "v1",
}

export type MessageOptions = {
  skipOpenApp?: boolean;
  /**
   * Off-chain message signing mode. Defaults to `V0`.
   *
   * - `V0` (default) — supported on all firmware with off-chain signing.
   *   Falls back to Legacy on `6a81`.
   * - `V1` — supported on firmware with V1 off-chain signing (not yet
   *   released). Falls back to V0 on `6a81`.
   * - `Legacy` — for backward compatibility with very old Solana app
   *   firmware. Current firmware will reject it.
   * - `Raw` — pass-through: the caller provides the fully formatted
   *   payload (as `Uint8Array`) and the SDK sends it as-is.
   *
   * Fallback cascade on `6a81` (invalid header):
   *   V1 -> V0 -> Legacy
   *   V0 -> Legacy
   *   Legacy / Raw -> no fallback
   */
  version?: SignMessageVersion;
  /**
   * V0 only: the application domain to include in the off-chain message header.
   * Encoded as UTF-8 and padded/truncated to 32 bytes.
   * If omitted, defaults to 32 zero bytes. Ignored for V1, Legacy, and Raw.
   *
   * @see https://docs.anza.xyz/proposals/off-chain-message-signing
   */
  appDomain?: string;
};
