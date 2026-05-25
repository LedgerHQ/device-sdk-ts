const HARDENED_OFFSET = 0x80000000;

/**
 * Encode a BIP44 derivation path for the Sui Ledger app.
 * Path components are encoded as little-endian u32 (unlike most Ledger apps which use big-endian).
 *
 * @param path - Derivation path string, e.g. "44'/784'/0'/0'/0'"
 * @returns Uint8Array with [count_byte, ...le_u32_components]
 */
export function encodeSuiDerivationPath(path: string): Uint8Array {
  const components = path
    .split("/")
    .filter((c) => c !== "m" && c !== "")
    .map((component) => {
      const hardened = component.endsWith("'");
      const index = parseInt(hardened ? component.slice(0, -1) : component, 10);
      if (isNaN(index) || index < 0) {
        throw new Error(`Invalid path component: ${component}`);
      }
      return hardened ? index + HARDENED_OFFSET : index;
    });

  // 1 byte for count + 4 bytes per component (little-endian)
  const buffer = new Uint8Array(1 + components.length * 4);
  buffer[0] = components.length;

  const view = new DataView(buffer.buffer);
  components.forEach((value, i) => {
    view.setUint32(1 + i * 4, value, true); // true = little-endian
  });

  return buffer;
}
