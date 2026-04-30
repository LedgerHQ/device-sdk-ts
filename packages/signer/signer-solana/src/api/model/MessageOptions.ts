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
  /**
   * V1 only: additional required signers to include in the off-chain message
   * header alongside the user's key. Per sRFC 38, this is the recommended
   * replacement for the V0 `appDomain` field — add the dApp's pubkey here to
   * bind the message to a specific application. Ignored for V0, Legacy, and Raw.
   *
   * Each entry must be a 32-byte Ed25519 public key (`Uint8Array` of length 32).
   * The V1 signer count is encoded as a `uint8`, so at most 254 additional
   * signers are supported (1 slot is reserved for the user's key). Passing a
   * signer with the wrong length or exceeding the limit returns an error before
   * any device communication.
   */
  signers?: Uint8Array[];
};
