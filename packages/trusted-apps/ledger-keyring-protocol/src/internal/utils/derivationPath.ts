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

export function derivationPathAsBytes(path: string): Uint8Array {
  return new Uint8Array(
    path
      .split("/")
      .slice(1)
      .flatMap((part) => {
        const hardened = part.endsWith("'");
        const number = hardened
          ? Number(part.slice(0, -1)) + 0x80000000
          : Number(part);
        const result = new Uint8Array(4);
        new DataView(result.buffer).setUint32(0, number, false);
        return Array.from(result);
      }),
  );
}
