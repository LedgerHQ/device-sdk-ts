export function derivationPathAsString(bytes: Uint8Array): string {
  const dataView = new DataView(bytes.buffer);
  return (
    "m/" +
    Array.from({ length: bytes.length / 4 }, (_, i) => i * 4)
      .map((offset) => dataView.getUint32(offset, false)) // Big-endian
      .map((segment) =>
        segment >= 0x80000000 ? `${segment - 0x80000000}'` : String(segment),
      )
      .join("/")
  );
}
