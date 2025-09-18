export type HexaString = `0x${string}`;

export function isHexaString(value: unknown): value is HexaString {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

export function hexaStringToBuffer(value: string): Uint8Array | null {
  if (value.startsWith("0x")) {
    value = value.slice(2);
  }
  if (value.length === 0) {
    return new Uint8Array();
  }
  if (value.length % 2 !== 0) {
    value = "0" + value;
  }
  if (/^[0-9a-fA-F]*$/.test(value) === false) {
    return null;
  }
  const bytes = value.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16));
  if (!bytes || bytes.some(isNaN)) {
    return null;
  }
  return new Uint8Array(bytes);
}

export function bufferToHexaString(
  value: Uint8Array,
  withPrefix?: true,
): HexaString;
export function bufferToHexaString(
  value: Uint8Array,
  withPrefix?: false,
): string;
export function bufferToHexaString(
  value: Uint8Array,
  withPrefix: boolean = true,
): HexaString | string {
  const prefix = withPrefix ? "0x" : "";
  return `${prefix}${Array.from(value, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export function numToHexaString(n: number): string {
  return `0x${n.toString(16).padStart(2, "0")}`;
}
