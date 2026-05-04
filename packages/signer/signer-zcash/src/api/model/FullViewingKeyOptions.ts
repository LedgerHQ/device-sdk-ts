/**
 * Device `P2` mode for GET_VK: UFVK string (default) or raw Orchard FVK bytes.
 */
export type ZcashFullViewingKeyMode = "ufvk" | "orchardFvk";

/**
 * - `mode`: which device `P2` encoding to use. Defaults to `ufvk`.
 * - `skipOpenApp`: when true, the flow assumes the Zcash app is already open.
 */
export type FullViewingKeyOptions = {
  readonly mode?: ZcashFullViewingKeyMode;
  readonly skipOpenApp?: boolean;
};
