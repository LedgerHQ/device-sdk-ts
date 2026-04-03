const HEX_RADIX = 16;
const HEX_CHARS_PER_BYTE = 2;

/**
 * Validates if a string is a valid hex string (even length, only hex characters).
 * Whitespace is ignored.
 */
export function isValidHexString(str: string): boolean {
  const cleaned = str.replace(/\s/g, "");
  return (
    /^[0-9a-fA-F]*$/.test(cleaned) && cleaned.length % HEX_CHARS_PER_BYTE === 0
  );
}

/**
 * Converts a hex string to a Uint8Array.
 * Whitespace is ignored.
 */
export function hexStringToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(cleaned.length / HEX_CHARS_PER_BYTE);
  for (let i = 0; i < cleaned.length; i += HEX_CHARS_PER_BYTE) {
    bytes[i / HEX_CHARS_PER_BYTE] = parseInt(
      cleaned.substring(i, i + HEX_CHARS_PER_BYTE),
      16,
    );
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a plain hex string (no spaces, no special characters).
 * Useful for copying to clipboard.
 *
 * Example: Uint8Array([0xe0, 0x01]) => "E001"
 */
export function toPlainHexString(raw: Uint8Array): string {
  return Array.from(raw)
    .map((byte) =>
      byte.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0").toUpperCase(),
    )
    .join("");
}

/**
 * Formats a Uint8Array as a displayable hex string.
 * Each byte is shown as 2 uppercase hex characters with a word joiner (U+2060)
 * between them (zero-width non-breaking character to prevent line breaks
 * within a byte), and a regular space between bytes.
 *
 * Example: Uint8Array([0xe0, 0x01]) => "E0 01" (with invisible joiner inside each byte)
 */
export function formatDisplayableHexString(raw: Uint8Array): string {
  return Array.from(raw)
    .map((byte) => {
      const hex = byte
        .toString(HEX_RADIX)
        .padStart(HEX_CHARS_PER_BYTE, "0")
        .toUpperCase();
      // Insert word joiner (zero-width non-breaking) between the two hex characters
      return hex[0] + "\u2060" + hex[1];
    })
    .join(" ");
}
