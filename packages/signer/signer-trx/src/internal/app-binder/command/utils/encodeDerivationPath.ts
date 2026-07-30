import { DerivationPathUtils } from "@ledgerhq/signer-utils";

/**
 * Encode a BIP32 derivation path the way the Tron app expects it at the start
 * of the GetAddress / Sign* payloads: a single byte holding the number of path
 * elements, followed by each element as a big-endian 32-bit unsigned integer.
 *
 * @param derivationPath a path in BIP32 format, e.g. "44'/195'/0'/0/0"
 * @returns the encoded path bytes
 */
export function encodeDerivationPath(derivationPath: string): Uint8Array {
  const elements = DerivationPathUtils.splitPath(derivationPath);
  const buffer = new Uint8Array(1 + elements.length * 4);
  buffer[0] = elements.length;

  const view = new DataView(buffer.buffer);
  elements.forEach((element, index) => {
    view.setUint32(1 + index * 4, element, false);
  });

  return buffer;
}
