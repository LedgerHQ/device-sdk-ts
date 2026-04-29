import { type SignableInput } from "@root/src/domain/models/SignableInput";

import { type SigningServiceResult } from "./TransactionSigningService";

export type { SigningServiceResult };

/** Unified signing service. Each chain provides its own implementation. */
export interface SigningService {
  /**
   * Sign the given input on the connected device.
   * Implementations may perform async preprocessing (e.g. transaction crafting)
   * before returning the observable signing result.
   * @param input - Discriminated {@link SignableInput} carrying the payload.
   * @param derivationPath - BIP-44 derivation path for the target account.
   */
  sign(
    input: SignableInput,
    derivationPath: string,
  ): SigningServiceResult | Promise<SigningServiceResult>;
}
