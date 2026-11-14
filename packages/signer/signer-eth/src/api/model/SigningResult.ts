import { type BlindSignReason } from "@ledgerhq/context-module";

import { type ClearSigningType } from "@api/model/ClearSigningType";

/**
 * How a signature was produced, as detected by the signer after signing.
 * Lets integrators tell a blind signature apart from a clear-signed one
 * in code instead of relying on the user to read the device screen.
 */
export type SigningResult = {
  /**
   * `true` when the device signed without clear signing context (blind
   * signing), including when the signer had to fall back to blind signing
   * after the device rejected the provided context.
   */
  readonly isBlindSign: boolean;
  /**
   * Why the signature was blind signed, or `null` when it was clear signed
   * (or when the reason could not be determined).
   */
  readonly blindSignReason: BlindSignReason | null;
  /**
   * Clear signing mode used for the signature that was returned.
   * `BASIC` when the signer fell back to blind signing, `null` when no
   * context was built.
   */
  readonly clearSigningType: ClearSigningType | null;
};
