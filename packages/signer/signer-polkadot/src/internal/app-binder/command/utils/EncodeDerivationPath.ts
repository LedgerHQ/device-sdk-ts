const DERIVATION_PATH_LENGTH = 5;
const BYTES_PER_ELEMENT = 4;

/**
 * Encodes a parsed derivation path into a 20-byte little-endian buffer.
 *
 * The Polkadot app reads the derivation path via memcpy into uint32_t[] on
 * ARM (little-endian). All path elements are passed through as-is from
 * DerivationPathUtils.splitPath() — the hardened flag (0x80000000) is
 * preserved without stripping or re-applying.
 *
 * This differs from the Cosmos encoder which strips and re-applies the hardened
 * flag for only the first 3 elements. Polkadot-family paths are fully
 * hardened (e.g. 44'/354'/0'/0'/0'), so all elements already carry the flag.
 */
export const encodeDerivationPath = (paths: number[]): Uint8Array => {
  if (paths.length !== DERIVATION_PATH_LENGTH) {
    throw new Error(
      `Expected ${DERIVATION_PATH_LENGTH} path elements, got ${paths.length}`,
    );
  }
  const dataView = new DataView(
    new ArrayBuffer(DERIVATION_PATH_LENGTH * BYTES_PER_ELEMENT),
  );
  for (let i = 0; i < paths.length; i++) {
    dataView.setUint32(i * BYTES_PER_ELEMENT, paths[i]! >>> 0, true); // little-endian
  }
  return new Uint8Array(dataView.buffer);
};
