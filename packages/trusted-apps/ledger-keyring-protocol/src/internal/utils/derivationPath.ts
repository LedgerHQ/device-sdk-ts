const UINT32_BYTE_LENGTH = 4;
const HARDENED_OFFSET = 0x80000000;

export function derivationPathAsString(bytes: Uint8Array): string {
  const dataView = new DataView(bytes.buffer);
  return (
    "m/" +
    Array.from(
      { length: bytes.length / UINT32_BYTE_LENGTH },
      (_, i) => i * UINT32_BYTE_LENGTH,
    )
      .map((offset) => dataView.getUint32(offset, false)) // Big-endian
      .map((segment) =>
        segment >= HARDENED_OFFSET
          ? `${segment - HARDENED_OFFSET}'`
          : String(segment),
      )
      .join("/")
  );
}

export function derivationPathAsBytes(path: string): Uint8Array {
  return new Uint8Array(
    path
      .split("/")
      .slice(1)
      .flatMap((part) => {
        const hardened = part.endsWith("'");
        const number = hardened
          ? Number(part.slice(0, -1)) + HARDENED_OFFSET
          : Number(part);
        const result = new Uint8Array(UINT32_BYTE_LENGTH);
        new DataView(result.buffer).setUint32(0, number, false);
        return Array.from(result);
      }),
  );
}
