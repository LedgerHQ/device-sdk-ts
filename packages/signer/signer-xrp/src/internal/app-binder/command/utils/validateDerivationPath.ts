import { DerivationPathUtils } from "@ledgerhq/signer-utils";

/**
 * The XRP application accepts at most 10 derivation path elements
 * (`doc/xrpapp.asc`), so a longer path is rejected here rather than being sent
 * to the device only to come back as an opaque status word.
 */
export const MAX_DERIVATION_PATH_LENGTH = 10;

export class DerivationPathTooLongError extends Error {
  constructor(readonly length: number) {
    super(
      `Derivation path has ${length} elements, the XRP app accepts at most ${MAX_DERIVATION_PATH_LENGTH}`,
    );
    this.name = "DerivationPathTooLongError";
  }
}

/**
 * Split a BIP32 derivation path into its elements and enforce the app's limit.
 *
 * Shared by the GetAddress and Sign commands, which encode the path the same
 * way: a single byte holding the number of elements, then each element as a
 * big-endian 32-bit unsigned integer.
 *
 * @param derivationPath a path in BIP32 format, e.g. "44'/144'/0'/0/0"
 * @throws DerivationPathTooLongError when the path exceeds
 *   {@link MAX_DERIVATION_PATH_LENGTH} elements
 */
export function validateDerivationPath(derivationPath: string): number[] {
  const path = DerivationPathUtils.splitPath(derivationPath);

  if (path.length > MAX_DERIVATION_PATH_LENGTH) {
    throw new DerivationPathTooLongError(path.length);
  }

  return path;
}
